// Supabase Edge Function: ouay-process-image-queue (Deno)
//
// Triggered every 60 seconds by pg_cron (see migration 05). Each run takes up
// to 3 image jobs that are pending or in flight, submits the pending ones to
// Replicate (FLUX Kontext Pro, with the character reference as the input image
// so every page stays visually consistent), and polls the in-flight ones —
// saving finished images to the ouay-images bucket. Fails a job after 3
// attempts so it never loops forever. When every job for an order is complete,
// the order moves to 'images_complete' (the admin "needs review" state).
//
// Deploy:  supabase functions deploy ouay-process-image-queue \
//            --project-ref fvyvtdwsomxfkpxwygpk --no-verify-jwt
// Secret:  supabase secrets set REPLICATE_API_TOKEN=... --project-ref fvyvtdwsomxfkpxwygpk

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const REPLICATE_TOKEN = Deno.env.get('REPLICATE_API_TOKEN')!
const KONTEXT_PRO_URL =
  'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions'
const MAX_ATTEMPTS = 3
const BATCH = 3

const db = createClient(SUPABASE_URL, SERVICE_KEY)

async function submitToReplicate(prompt: string, inputImage: string | null): Promise<string> {
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: '1:1',
    output_format: 'png',
    safety_tolerance: 2,
  }
  if (inputImage) input.input_image = inputImage
  const res = await fetch(KONTEXT_PRO_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REPLICATE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  })
  if (!res.ok) throw new Error(`Replicate submit ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  return data.id
}

async function pollReplicate(predictionId: string): Promise<Record<string, any>> {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Replicate poll ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return await res.json()
}

function outputUrl(prediction: Record<string, any>): string | null {
  const out = prediction?.output
  if (!out) return null
  return Array.isArray(out) ? out[0] : out
}

async function saveImage(url: string, orderId: string, jobKey: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch image failed: ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const filename = `${orderId}/${jobKey.replace(/[:]/g, '_')}.png`
  const up = await db.storage.from('ouay-images').upload(filename, bytes, {
    contentType: 'image/png',
    upsert: true,
  })
  if (up.error) throw new Error(`upload failed: ${up.error.message}`)
  return db.storage.from('ouay-images').getPublicUrl(filename).data.publicUrl
}

async function failJob(job: Record<string, any>, message: string) {
  const attempts = (job.attempts || 0) + 1
  const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'
  await db
    .from('ouay_image_jobs')
    .update({
      status,
      attempts,
      prediction_id: null,
      error_message: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
}

// Moves an order to images_complete when all its jobs are done, or
// images_failed when nothing is left running but some job permanently failed.
async function maybeFinishOrder(orderId: string) {
  const { data: jobs } = await db
    .from('ouay_image_jobs')
    .select('status')
    .eq('order_id', orderId)
  const list = jobs || []
  const anyRunning = list.some((j) => j.status === 'pending' || j.status === 'processing')
  if (anyRunning) return
  const anyFailed = list.some((j) => j.status === 'failed')
  const next = anyFailed ? 'images_failed' : 'images_complete'
  await db.from('ouay_orders').update({ status: next, updated_at: new Date().toISOString() }).eq('id', orderId)
}

Deno.serve(async () => {
  try {
    const { data: jobs } = await db
      .from('ouay_image_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })
      .limit(BATCH)

    const affectedOrders = new Set<string>()

    for (const job of jobs || []) {
      affectedOrders.add(job.order_id)
      try {
        if (job.status === 'pending') {
          const predictionId = await submitToReplicate(job.prompt, job.hero_ref_url || null)
          await db
            .from('ouay_image_jobs')
            .update({ status: 'processing', prediction_id: predictionId, updated_at: new Date().toISOString() })
            .eq('id', job.id)
        } else if (job.status === 'processing' && job.prediction_id) {
          const prediction = await pollReplicate(job.prediction_id)
          if (prediction.status === 'succeeded') {
            const imgUrl = outputUrl(prediction)
            if (!imgUrl) throw new Error('succeeded but no output URL')
            const publicUrl = await saveImage(imgUrl, job.order_id, job.job_key)
            await db
              .from('ouay_image_jobs')
              .update({ status: 'complete', image_url: publicUrl, error_message: null, updated_at: new Date().toISOString() })
              .eq('id', job.id)
          } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
            await failJob(job, `Replicate ${prediction.status}: ${prediction.error || 'unknown'}`)
          }
          // still processing → leave it for the next run
        }
      } catch (e) {
        await failJob(job, String((e as Error)?.message ?? e))
      }
    }

    for (const orderId of affectedOrders) {
      await maybeFinishOrder(orderId)
    }

    return new Response(JSON.stringify({ processed: (jobs || []).length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
