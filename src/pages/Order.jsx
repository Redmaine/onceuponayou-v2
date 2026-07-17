import { useMemo, useState } from 'react'
import Layout from '../components/Layout.jsx'
import { PRODUCTS, PRODUCT_DESCRIPTIONS, PRODUCT_ORDER, isPrintProduct } from '../lib/products.js'
import { STORY_TYPES, ADVENTURE_THEMES } from '../lib/themes.js'

const GENDER_OPTIONS = [
  { value: 'boy', label: 'Boy' },
  { value: 'girl', label: 'Girl' },
  { value: 'child', label: 'They prefer not to say' },
]

export default function Order() {
  const [stepIdx, setStepIdx] = useState(0)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    product_type: '',
    story_type: '',
    hero_name: '',
    hero_age: '',
    hero_gender: '',
    hero_hair: '',
    hero_skin: '',
    hero_features: '',
    photo_base64: '',
    photo_content_type: '',
    photo_name: '',
    photo_consent: false,
    themes: [],
    dedication: '',
    delivery_name: '',
    delivery: { line1: '', line2: '', town: '', county: '', postcode: '', country: 'United Kingdom' },
  })

  const product = form.product_type ? PRODUCTS[form.product_type] : null
  const printProduct = form.product_type ? isPrintProduct(form.product_type) : false
  // Ebook-only products let the customer pick every theme; print/bundle
  // products pick only the single print theme (bundle ebook themes are
  // randomised server-side).
  const themesToPick = product ? (product.printCount > 0 ? 1 : product.ebookCount) : 1

  const steps = useMemo(() => {
    const base = ['product', 'storytype', 'hero', 'themes', 'dedication']
    if (printProduct) base.push('delivery')
    base.push('review')
    return base
  }, [printProduct])

  const step = steps[Math.min(stepIdx, steps.length - 1)]

  function set(patch) { setForm((f) => ({ ...f, ...patch })) }
  function setDelivery(patch) { setForm((f) => ({ ...f, delivery: { ...f.delivery, ...patch } })) }

  function toggleTheme(theme) {
    setForm((f) => {
      const has = f.themes.includes(theme)
      if (has) return { ...f, themes: f.themes.filter((t) => t !== theme) }
      if (f.themes.length >= themesToPick) {
        // Single-pick steps replace; multi-pick steps cap at the limit.
        return themesToPick === 1 ? { ...f, themes: [theme] } : f
      }
      return { ...f, themes: [...f.themes, theme] }
    })
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set({ photo_base64: String(reader.result), photo_content_type: file.type, photo_name: file.name })
    reader.readAsDataURL(file)
  }

  function validateStep() {
    setError('')
    if (step === 'product' && !form.product_type) return 'Please choose a book.'
    if (step === 'storytype' && !form.story_type) return 'Please choose a story type.'
    if (step === 'hero') {
      if (!form.hero_name.trim()) return "Please enter your child's name."
      const age = Number(form.hero_age)
      if (!Number.isInteger(age) || age < 1 || age > 10) return 'Please enter an age between 1 and 10.'
      if (!form.hero_gender) return 'Please choose an option.'
      if (printProduct && !form.photo_base64) return 'A photo is required for printed books.'
      if (form.photo_base64 && !form.photo_consent) return 'Please tick the consent box to upload a photo.'
      if (!form.photo_base64 && !form.hero_hair.trim()) return 'Please add a photo, or describe their hair colour.'
    }
    if (step === 'themes' && form.themes.length < themesToPick) {
      return `Please choose ${themesToPick} theme${themesToPick > 1 ? 's' : ''}.`
    }
    if (step === 'delivery') {
      const d = form.delivery
      if (!form.delivery_name.trim()) return 'Please enter the recipient name.'
      if (!d.line1.trim() || !d.town.trim() || !d.postcode.trim()) return 'Please complete the delivery address.'
    }
    return ''
  }

  function next() {
    const err = validateStep()
    if (err) { setError(err); return }
    setStepIdx((i) => Math.min(i + 1, steps.length - 1))
  }
  function back() { setError(''); setStepIdx((i) => Math.max(i - 1, 0)) }

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        product_type: form.product_type,
        story_type: form.story_type,
        hero_name: form.hero_name.trim(),
        hero_age: Number(form.hero_age),
        hero_gender: form.hero_gender,
        hero_hair: form.hero_hair.trim() || null,
        hero_skin: form.hero_skin.trim() || null,
        hero_features: form.hero_features.trim() || null,
        dedication: form.dedication.trim() || null,
        theme: form.themes[0] || null,
        theme2: form.themes[1] || null,
        theme3: form.themes[2] || null,
        photo_base64: form.photo_base64 || null,
        photo_content_type: form.photo_content_type || null,
        photo_consent: form.photo_consent,
      }
      if (printProduct) {
        payload.delivery_name = form.delivery_name.trim()
        payload.delivery_address = form.delivery
      }
      const res = await fetch('/api/save-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save your order.')
      window.location.href = data.checkout_url
    } catch (e) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      <div className="order-shell">
        <div className="container narrow">
          <div className="progress">
            {steps.map((s, i) => (
              <div key={s} className={`pip ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}`} />
            ))}
          </div>

          {error && <div className="error">{error}</div>}

          {step === 'product' && (
            <>
              <h1 className="step-title">Choose your book</h1>
              <p className="step-sub">Every option is a complete, personalised story starring your child.</p>
              <div className="choice-grid">
                {PRODUCT_ORDER.map((key) => {
                  const p = PRODUCTS[key]
                  return (
                    <button type="button" key={key} className={`choice ${form.product_type === key ? 'selected' : ''}`} onClick={() => set({ product_type: key, themes: [] })}>
                      <h4>{p.label}</h4>
                      <div className="price">£{p.price.toFixed(2)}</div>
                      <p>{PRODUCT_DESCRIPTIONS[key]}</p>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {step === 'storytype' && (
            <>
              <h1 className="step-title">What kind of story?</h1>
              <p className="step-sub">Choose the feeling you'd like the book to leave behind.</p>
              <div className="choice-grid">
                {STORY_TYPES.map((t) => (
                  <button type="button" key={t.id} className={`choice ${form.story_type === t.id ? 'selected' : ''}`} onClick={() => set({ story_type: t.id })}>
                    <h4>{t.label}</h4>
                    <p><strong>{t.tagline}.</strong> {t.description}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'hero' && (
            <>
              <h1 className="step-title">Tell us about your hero</h1>
              <p className="step-sub">This is how we capture your child on every page.</p>
              <div className="field">
                <label>Child's name</label>
                <input type="text" value={form.hero_name} onChange={(e) => set({ hero_name: e.target.value })} placeholder="e.g. Lottie" />
              </div>
              <div className="field">
                <label>Age</label>
                <input type="number" min="1" max="10" value={form.hero_age} onChange={(e) => set({ hero_age: e.target.value })} placeholder="1–10" />
              </div>
              <div className="field">
                <label>Gender</label>
                <div className="choice-grid">
                  {GENDER_OPTIONS.map((g) => (
                    <button type="button" key={g.value} className={`choice ${form.hero_gender === g.value ? 'selected' : ''}`} onClick={() => set({ hero_gender: g.value })}>
                      <h4>{g.label}</h4>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Photo {printProduct ? '(required for printed books)' : '(optional for ebooks)'}</label>
                <input type="file" accept="image/*" onChange={onPhoto} />
                {form.photo_name && <div className="hint">Selected: {form.photo_name}</div>}
              </div>
              {form.photo_base64 && (
                <label className="consent">
                  <input type="checkbox" checked={form.photo_consent} onChange={(e) => set({ photo_consent: e.target.checked })} />
                  <span>I consent to this photo being used to generate AI illustrations for this book order. Photos are deleted from our servers after your book is complete.</span>
                </label>
              )}

              <p className="step-sub" style={{ marginTop: 22 }}>No photo? Describe them instead:</p>
              <div className="field">
                <label>Hair colour {!form.photo_base64 && '(needed if no photo)'}</label>
                <input type="text" value={form.hero_hair} onChange={(e) => set({ hero_hair: e.target.value })} placeholder="e.g. curly auburn" />
              </div>
              <div className="field">
                <label>Skin tone</label>
                <input type="text" value={form.hero_skin} onChange={(e) => set({ hero_skin: e.target.value })} placeholder="e.g. warm brown" />
              </div>
              <div className="field">
                <label>Any features</label>
                <input type="text" value={form.hero_features} onChange={(e) => set({ hero_features: e.target.value })} placeholder="e.g. glasses, freckles" />
              </div>
            </>
          )}

          {step === 'themes' && (
            <>
              <h1 className="step-title">Choose {themesToPick > 1 ? `${themesToPick} themes` : 'a theme'}</h1>
              <p className="step-sub">
                {product && product.printCount > 0 && product.ebookCount > 0
                  ? "This is the theme for the printed book. We'll surprise you with different themes for the ebook stories."
                  : `Pick the setting${themesToPick > 1 ? 's' : ''} for your ${themesToPick > 1 ? 'stories' : 'story'}.`}
              </p>
              <div className="theme-grid">
                {ADVENTURE_THEMES.map((t) => (
                  <button type="button" key={t} className={`theme-chip ${form.themes.includes(t) ? 'selected' : ''}`} onClick={() => toggleTheme(t)}>{t}</button>
                ))}
              </div>
              <div className="hint" style={{ marginTop: 10 }}>{form.themes.length} of {themesToPick} chosen</div>
            </>
          )}

          {step === 'dedication' && (
            <>
              <h1 className="step-title">Add a dedication</h1>
              <p className="step-sub">Optional — a personal message we'll print inside the book.</p>
              <div className="field">
                <textarea value={form.dedication} onChange={(e) => set({ dedication: e.target.value })} placeholder={`To ${form.hero_name || '[name]'}, ...`} />
              </div>
            </>
          )}

          {step === 'delivery' && (
            <>
              <h1 className="step-title">Where shall we send it?</h1>
              <p className="step-sub">Your printed book will be posted here.</p>
              <div className="field"><label>Recipient name</label><input type="text" value={form.delivery_name} onChange={(e) => set({ delivery_name: e.target.value })} /></div>
              <div className="field"><label>Address line 1</label><input type="text" value={form.delivery.line1} onChange={(e) => setDelivery({ line1: e.target.value })} /></div>
              <div className="field"><label>Address line 2</label><input type="text" value={form.delivery.line2} onChange={(e) => setDelivery({ line2: e.target.value })} /></div>
              <div className="field"><label>Town / City</label><input type="text" value={form.delivery.town} onChange={(e) => setDelivery({ town: e.target.value })} /></div>
              <div className="field"><label>County</label><input type="text" value={form.delivery.county} onChange={(e) => setDelivery({ county: e.target.value })} /></div>
              <div className="field"><label>Postcode</label><input type="text" value={form.delivery.postcode} onChange={(e) => setDelivery({ postcode: e.target.value })} /></div>
              <div className="field"><label>Country</label><input type="text" value={form.delivery.country} onChange={(e) => setDelivery({ country: e.target.value })} /></div>
            </>
          )}

          {step === 'review' && (
            <>
              <h1 className="step-title">Review &amp; pay</h1>
              <p className="step-sub">One last look before we take you to secure checkout.</p>
              <div className="summary-line"><span>Book</span><strong>{product?.label}</strong></div>
              <div className="summary-line"><span>Story type</span><strong>{STORY_TYPES.find((t) => t.id === form.story_type)?.label}</strong></div>
              <div className="summary-line"><span>Hero</span><strong>{form.hero_name}, age {form.hero_age}</strong></div>
              <div className="summary-line"><span>Theme{form.themes.length > 1 ? 's' : ''}</span><strong>{form.themes.join(', ') || '—'}</strong></div>
              {form.dedication && <div className="summary-line"><span>Dedication</span><strong>“{form.dedication}”</strong></div>}
              {printProduct && <div className="summary-line"><span>Deliver to</span><strong>{form.delivery_name}, {form.delivery.postcode}</strong></div>}
              <div className="summary-line" style={{ fontSize: 20 }}><span>Total</span><strong style={{ color: 'var(--gold)' }}>£{product?.price.toFixed(2)}</strong></div>
              <p className="notice" style={{ marginTop: 18 }}>You'll be taken to Stripe to pay securely. Your book is created automatically as soon as your payment is confirmed.</p>
            </>
          )}

          <div className="row-nav">
            {stepIdx > 0 ? <button className="btn btn-ghost" onClick={back} disabled={submitting}>Back</button> : <span />}
            {step === 'review'
              ? <button className="btn btn-primary" onClick={submit} disabled={submitting}>{submitting ? 'Taking you to checkout…' : `Pay £${product?.price.toFixed(2)}`}</button>
              : <button className="btn btn-primary" onClick={next}>Continue</button>}
          </div>
        </div>
      </div>
    </Layout>
  )
}
