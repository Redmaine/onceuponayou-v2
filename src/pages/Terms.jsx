import Layout from '../components/Layout.jsx'

export default function Terms() {
  return (
    <Layout>
      <section className="section">
        <div className="container narrow">
          <h1 className="step-title">Terms &amp; Conditions</h1>

          <h3>What you're buying</h3>
          <p>Once Upon A You sells a personalised, AI-generated children's book: a story and a set of illustrations created specifically for your child, based on the details (and optional photo) you provide at the time of order. Each book is unique to the order that created it.</p>

          <h3>AI disclosure</h3>
          <p>The story text and illustrations in your book are created using artificial intelligence, based on the information and photos you provide — your child's name, age and any description or photo you supply. A person reviews every book before it is delivered, but no book is hand-written or hand-illustrated by a human artist.</p>

          <h3>Delivery times</h3>
          <p>Ebooks are delivered within 2 hours of payment confirmation. Printed books are made and posted within 5–7 working days of payment confirmation. Delivery times may occasionally be longer at busy periods — we'll email you if that happens.</p>

          <h3>Refund policy</h3>
          <p>Because every book is personalised and made to order, we can't offer refunds or exchanges for a change of mind once your order has been placed. If your book arrives damaged, or there's a fault on our side, email us within 14 days of delivery and we'll put it right with a replacement or a refund.</p>

          <p style={{ color: 'var(--muted)' }}>Once Upon A You · hello@onceuponayou.co.uk</p>
        </div>
      </section>
    </Layout>
  )
}
