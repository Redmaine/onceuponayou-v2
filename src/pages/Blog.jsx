import { Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { getAllPosts } from '../lib/blog.js'

function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Blog() {
  const posts = getAllPosts()
  return (
    <Layout>
      <section className="section">
        <div className="container narrow">
          <h1 className="step-title">The Storybook Journal</h1>
          <p className="lede">Ideas on reading together, bedtime rituals, and why seeing themselves in a story helps children feel brave.</p>

          {posts.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>New stories are on their way — check back soon.</p>
          ) : (
            <div className="cards" style={{ marginTop: 24 }}>
              {posts.map((post) => (
                <Link key={post.slug} to={`/blog/${post.slug}`} className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  {post.date && <div className="tag" style={{ marginBottom: 8 }}>{formatDate(post.date)}</div>}
                  <h3 style={{ marginBottom: 6 }}>{post.title}</h3>
                  {post.excerpt && <p style={{ color: 'var(--muted)', margin: 0 }}>{post.excerpt}</p>}
                  <span style={{ display: 'inline-block', marginTop: 12, color: 'var(--green)', fontWeight: 600 }}>Read more →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  )
}
