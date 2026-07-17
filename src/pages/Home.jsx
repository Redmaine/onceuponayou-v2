import { Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { PRODUCTS, PRODUCT_DESCRIPTIONS, PRODUCT_ORDER } from '../lib/products.js'
import { STORY_TYPES } from '../lib/themes.js'

export default function Home() {
  return (
    <Layout>
      <section className="hero">
        <div className="container">
          <h1>Every child deserves to be the hero of their own story</h1>
          <p>Personalised, beautifully illustrated children's books — written and painted just for your little one, and delivered to your door.</p>
          <Link to="/order" className="btn btn-gold">Create Your Book</Link>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>How it works</h2>
          <p className="lede">Three gentle steps between here and a book they'll ask for every bedtime.</p>
          <div className="steps">
            <div className="step"><div className="num">1</div><h3>Tell us about them</h3><p>Their name, their age, and a photo (or a quick description) so we can capture their likeness.</p></div>
            <div className="step"><div className="num">2</div><h3>We create the magic</h3><p>A one-of-a-kind story is written and hand-painted in a warm picture-book style, starring your child.</p></div>
            <div className="step"><div className="num">3</div><h3>Delivered to your door</h3><p>As a keepsake printed book, a downloadable ebook, or both.</p></div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: '#fff' }}>
        <div className="container">
          <h2>Choose your book</h2>
          <p className="lede">From a quick ebook to a premium hardcover heirloom.</p>
          <div className="cards">
            {PRODUCT_ORDER.map((key) => {
              const p = PRODUCTS[key]
              return (
                <div className="card" key={key}>
                  <h3>{p.label}</h3>
                  <div className="price">£{p.price.toFixed(2)}</div>
                  <p>{PRODUCT_DESCRIPTIONS[key]}</p>
                </div>
              )
            })}
          </div>
          <div style={{ textAlign: 'center', marginTop: 34 }}>
            <Link to="/order" className="btn btn-primary">Start your child's book</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Three kinds of story</h2>
          <p className="lede">Pick the feeling you want the book to leave behind.</p>
          <div className="storytypes">
            {STORY_TYPES.map((t) => (
              <div className="storytype" key={t.id}>
                <div className="tag">{t.tagline}</div>
                <h3>{t.label}</h3>
                <p>{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--green-soft)' }}>
        <div className="container narrow" style={{ textAlign: 'center' }}>
          <h2>Painted, not printed-out</h2>
          <p className="lede">Every page is illustrated in a warm, soft, painterly picture-book style — rich colour, golden light, and your child at the heart of it. No flat clip-art, no uncanny photo-mashups.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Questions, answered</h2>
          <div className="faq">
            <details><summary>How long does it take?</summary><p>Ebooks are usually ready within a day. Printed books are lovingly made and posted within 5–7 days.</p></details>
            <details><summary>Do I need a photo?</summary><p>A photo is required for printed books so we can capture your child's likeness. For ebooks it's optional — you can describe their hair, skin tone and any features instead.</p></details>
            <details><summary>What happens to my child's photo?</summary><p>It's used only to generate the illustrations for your book, and deleted from our servers once your order is complete. See our <Link to="/privacy">privacy policy</Link>.</p></details>
            <details><summary>Can I add a dedication?</summary><p>Yes — you can add a personal dedication that we'll print inside the book.</p></details>
            <details><summary>Which ages is it for?</summary><p>Stories are tailored to your child's age, from 1 to 10 — the language and pacing adjust to suit.</p></details>
          </div>
        </div>
      </section>
    </Layout>
  )
}
