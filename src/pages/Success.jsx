import { Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'

export default function Success() {
  return (
    <Layout>
      <section className="section">
        <div className="container narrow" style={{ textAlign: 'center' }}>
          <h1 className="step-title" style={{ fontSize: 36 }}>Your magical book is on its way to becoming real ✦</h1>
          <p className="step-sub" style={{ fontSize: 18 }}>
            Thank you — your payment is confirmed and our storytellers are already getting to work.
          </p>
          <div className="notice" style={{ textAlign: 'left' }}>
            <p style={{ marginTop: 0 }}><strong>What happens next</strong></p>
            <p>We're writing and painting your child's one-of-a-kind story now. You'll get a confirmation email straight away, and:</p>
            <ul>
              <li>Ebooks arrive by email, usually within a day.</li>
              <li>Printed books are made and posted within 5–7 days — we'll email tracking when they ship.</li>
            </ul>
          </div>
          <p style={{ marginTop: 28 }}>
            <Link to="/" className="btn btn-primary">Back to home</Link>
          </p>
        </div>
      </section>
    </Layout>
  )
}
