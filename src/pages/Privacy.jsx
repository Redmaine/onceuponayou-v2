import Layout from '../components/Layout.jsx'

export default function Privacy() {
  return (
    <Layout>
      <section className="section">
        <div className="container narrow">
          <h1 className="step-title">Privacy, data &amp; returns</h1>

          <h3>Your child's photo</h3>
          <p>If you upload a photo, it is used solely to generate the AI illustrations for your book. We never sell it, never use it to train models beyond producing your order, and never share it with third parties except our image-generation provider strictly to create your book. Photos are deleted from our servers once your order is complete.</p>

          <h3>Children's data</h3>
          <p>We collect only what we need to make and deliver the book — your child's first name, age, an optional likeness (photo or description), and your delivery details. None of this is retained beyond order fulfilment and our legal record-keeping obligations, and it is never used for marketing to children.</p>

          <h3>How we use AI</h3>
          <p>Stories are written with a large language model and illustrations are generated with an AI image model, both from the details you provide. A person reviews every book before it is printed or delivered. The photo (if provided) is used to guide the illustrated likeness only.</p>

          <h3>Your data rights</h3>
          <p>You can ask us to access, correct or delete your personal data at any time by emailing <a href="mailto:hello@onceuponayou.co.uk">hello@onceuponayou.co.uk</a>. We process your order data under our legitimate interest in fulfilling your purchase and our contract with you.</p>

          <h3>Payments</h3>
          <p>Payments are handled securely by Stripe. We never see or store your full card details.</p>

          <h3>Returns</h3>
          <p>Because every book is uniquely personalised and made to order, we can't accept returns for a change of mind. If your book arrives damaged or there's a fault on our side, email us within 14 days and we'll put it right — a replacement or a refund.</p>

          <p style={{ color: 'var(--muted)' }}>Once Upon A You · hello@onceuponayou.co.uk</p>
        </div>
      </section>
    </Layout>
  )
}
