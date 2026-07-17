import { useEffect, useState, useCallback } from 'react'
import Layout from '../components/Layout.jsx'
import { PRODUCTS } from '../lib/products.js'

const STATUS_FILTERS = ['', 'paid', 'generating', 'images_pending', 'images_complete', 'printing', 'dispatched', 'complete']

function badgeClass(status) {
  if (status === 'images_complete') return 'review'
  if (['complete', 'dispatched'].includes(status)) return 'done'
  if (String(status).endsWith('_failed')) return 'fail'
  return 'wip'
}

function api(secret, path, opts = {}) {
  return fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret, ...(opts.headers || {}) },
  })
}

export default function Admin() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem('ouay_admin_secret') || '')
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')

  const [list, setList] = useState(null)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(null) // order detail
  const [busy, setBusy] = useState(false)

  const loadList = useCallback(async (s) => {
    const res = await api(s, `/api/admin-data?action=list${filter ? `&status=${filter}` : ''}`)
    if (res.status === 401) { setAuthed(false); setError('Wrong password'); sessionStorage.removeItem('ouay_admin_secret'); return }
    const data = await res.json()
    setList(data)
    setAuthed(true)
  }, [filter])

  useEffect(() => { if (secret) loadList(secret) }, [secret, loadList])

  async function login(e) {
    e.preventDefault()
    setError('')
    const res = await api(pw, '/api/admin-data?action=list')
    if (res.status === 401) { setError('Wrong password'); return }
    sessionStorage.setItem('ouay_admin_secret', pw)
    setSecret(pw)
  }

  async function openOrder(ref) {
    const res = await api(secret, `/api/admin-data?action=order&order_ref=${encodeURIComponent(ref)}`)
    const data = await res.json()
    setSelected(data)
  }

  async function approve(ref) {
    if (!confirm('Approve this order? PDFs will be assembled and the order sent to print and/or emailed.')) return
    setBusy(true)
    await api(secret, '/api/admin-approve', { method: 'POST', body: JSON.stringify({ order_ref: ref }) })
    // Background — poll the order until its status settles.
    const poll = setInterval(async () => {
      const res = await api(secret, `/api/admin-data?action=order&order_ref=${encodeURIComponent(ref)}`)
      const data = await res.json()
      setSelected(data)
      const st = data.order?.status
      if (['printing', 'complete', 'approve_failed'].includes(st)) {
        clearInterval(poll); setBusy(false); loadList(secret)
      }
    }, 4000)
  }

  async function dispatch(ref) {
    const tracking = prompt('Tracking number (optional):') || ''
    setBusy(true)
    await api(secret, '/api/admin-dispatch', { method: 'POST', body: JSON.stringify({ order_ref: ref, tracking_number: tracking }) })
    await openOrder(ref)
    await loadList(secret)
    setBusy(false)
  }

  if (!authed) {
    return (
      <Layout>
        <div className="admin-shell"><div className="container narrow">
          <h1 className="step-title">Admin</h1>
          {error && <div className="error">{error}</div>}
          <form onSubmit={login}>
            <div className="field"><label>Password</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <button className="btn btn-primary" type="submit">Sign in</button>
          </form>
        </div></div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="admin-shell"><div className="container">
        {!selected ? (
          <>
            <h1 className="step-title">Orders</h1>
            <div className="stat-row">
              <div className="stat"><div className="v">{list?.orders?.length ?? '—'}</div><div className="k">Orders shown</div></div>
              <div className="stat"><div className="v">£{((list?.revenuePence || 0) / 100).toFixed(2)}</div><div className="k">Revenue</div></div>
              <div className="stat"><div className="v">{list?.needsReview ?? 0}</div><div className="k">Needs review</div></div>
            </div>
            <div className="field" style={{ maxWidth: 280 }}>
              <label>Filter by status</label>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s || 'All'}</option>)}
              </select>
            </div>
            <table className="table">
              <thead><tr><th>Order</th><th>Hero</th><th>Product</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {(list?.orders || []).map((o) => (
                  <tr key={o.id} onClick={() => openOrder(o.order_ref)}>
                    <td>{o.order_ref}</td>
                    <td>{o.hero_name}</td>
                    <td>{PRODUCTS[o.product_type]?.label || o.product_type}</td>
                    <td>£{((o.amount_paid || 0) / 100).toFixed(2)}</td>
                    <td><span className={`badge ${badgeClass(o.status)}`}>{o.status}</span></td>
                    <td>{new Date(o.created_at).toLocaleDateString('en-GB')}</td>
                  </tr>
                ))}
                {list && !list.orders.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>No orders.</td></tr>}
              </tbody>
            </table>
          </>
        ) : (
          <OrderDetail data={selected} onBack={() => setSelected(null)} onApprove={approve} onDispatch={dispatch} busy={busy} />
        )}
      </div></div>
    </Layout>
  )
}

function OrderDetail({ data, onBack, onApprove, onDispatch, busy }) {
  const { order, stories, imagesByStory } = data
  const product = PRODUCTS[order.product_type]
  const canApprove = order.status === 'images_complete'
  const canDispatch = order.status === 'printing'

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back to orders</button>
      <h1 className="step-title" style={{ marginTop: 16 }}>{order.order_ref} — {order.hero_name}</h1>
      <p><span className={`badge ${badgeClass(order.status)}`}>{order.status}</span></p>

      <div className="cards" style={{ marginBottom: 24 }}>
        <div className="card"><h3>Order</h3>
          <p>{product?.label} · £{((order.amount_paid || 0) / 100).toFixed(2)}<br />
          {order.customer_name} &lt;{order.customer_email}&gt;<br />
          Story type: {order.story_type}<br />
          Themes: {[order.theme, order.theme2, order.theme3].filter(Boolean).join(', ') || '—'}</p>
        </div>
        <div className="card"><h3>Hero</h3>
          <p>{order.hero_name}, age {order.hero_age}, {order.hero_gender}<br />
          {[order.hero_hair, order.hero_skin, order.hero_features].filter(Boolean).join(' · ') || 'from photo'}</p>
          {order.hero_ref_url && <img src={order.hero_ref_url} alt="character reference" style={{ maxWidth: 140, borderRadius: 10, marginTop: 8 }} />}
        </div>
        <div className="card"><h3>Delivery</h3>
          <p>{order.delivery_address
            ? [order.delivery_name, order.delivery_address.line1, order.delivery_address.town, order.delivery_address.postcode].filter(Boolean).join(', ')
            : 'Ebook — email delivery'}</p>
          {order.tracking_number && <p>Tracking: <strong>{order.tracking_number}</strong></p>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 26 }}>
        {canApprove && <button className="btn btn-primary" onClick={() => onApprove(order.order_ref)} disabled={busy}>{busy ? 'Working…' : 'Approve'}</button>}
        {canDispatch && <button className="btn btn-gold" onClick={() => onDispatch(order.order_ref)} disabled={busy}>{busy ? 'Working…' : 'Mark dispatched'}</button>}
        {order.ebook_pdf_url && <a className="btn btn-ghost btn-sm" href={order.ebook_pdf_url} target="_blank" rel="noreferrer">Ebook PDF</a>}
        {order.interior_pdf_url && <a className="btn btn-ghost btn-sm" href={order.interior_pdf_url} target="_blank" rel="noreferrer">Interior PDF</a>}
        {order.cover_pdf_url && <a className="btn btn-ghost btn-sm" href={order.cover_pdf_url} target="_blank" rel="noreferrer">Cover PDF</a>}
      </div>

      {(stories || []).map((s) => {
        const imgs = imagesByStory?.[s.id] || []
        return (
          <div key={s.id} style={{ marginBottom: 30 }}>
            <h3 style={{ color: 'var(--green)' }}>Story {s.story_number}: {s.title} {s.is_ebook ? '(ebook)' : '(print)'}
              {s.sense_check_passed === false && <span className="badge fail" style={{ marginLeft: 8 }}>sense-check flags</span>}
            </h3>
            {s.sense_check_errors && <p className="hint">{(s.sense_check_errors || []).join(' · ')}</p>}
            <div className="img-grid">
              {imgs.map((j) => (
                <figure key={j.job_key}>
                  {j.image_url ? <img src={j.image_url} alt={j.job_key} /> : <div className="placeholder">{j.status}</div>}
                  <figcaption>{j.page_number === 0 ? 'Cover' : j.page_number === 99 ? 'Back' : `Page ${j.page_number}`}</figcaption>
                </figure>
              ))}
              {!imgs.length && <p className="hint">No image jobs yet.</p>}
            </div>
          </div>
        )
      })}
    </>
  )
}
