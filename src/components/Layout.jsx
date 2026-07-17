import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header className="site-header">
      <div className="container inner">
        <Link to="/" className="brandmark">Once Upon A You <small>✦</small></Link>
        <Link to="/order" className="btn btn-primary btn-sm">Create Your Book</Link>
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
