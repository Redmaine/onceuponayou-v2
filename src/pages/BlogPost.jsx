import { useParams, Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { getPost } from '../lib/blog.js'

function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = getPost(slug)

  if (!post) {
    return (
      <Layout>
        <section className="section">
          <div className="container narrow">
            <h1 className="step-title">Story not found</h1>
            <p style={{ color: 'var(--muted)' }}>We couldn't find that post.</p>
            <p><Link to="/blog" className="btn btn-primary btn-sm">Back to the journal</Link></p>
          </div>
        </section>
      </Layout>
    )
  }

  return (
    <Layout>
      <article className="section">
        <div className="container narrow">
          <Link to="/blog" style={{ color: 'var(--muted)', textDecoration: 'none' }}>← The Storybook Journal</Link>
          <h1 className="step-title" style={{ marginTop: 16 }}>{post.title}</h1>
          {post.date && <p className="tag" style={{ marginBottom: 24 }}>{formatDate(post.date)}</p>}
          <div className="blog-body" dangerouslySetInnerHTML={{ __html: post.html }} />
          <p style={{ marginTop: 40 }}>
            <Link to="/order" className="btn btn-primary">Create your child's book</Link>
          </p>
        </div>
      </article>
    </Layout>
  )
}
