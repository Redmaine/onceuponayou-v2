import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header className="site-header">
      <div className="container inner">
        <Link to="/" className="brandmark">Once Upon A You <small>✦</small></Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/blog" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>Journal</Link>
          <Link to="/order" className="btn btn-primary btn-sm">Create Your Book</Link>
        </nav>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container inner">
        <div>© {new Date().getFullYear()} Once Upon A You</div>
        <div>
          <a href="mailto:hello@onceuponayou.co.uk">hello@onceuponayou.co.uk</a>
          {' · '}
          <Link to="/privacy">Privacy &amp; returns</Link>
          {' · '}
          <Link to="/terms">Terms &amp; Conditions</Link>
        </div>
      </div>
    </footer>
  )
}

export default function Layout({ children }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  )
}
