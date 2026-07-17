import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Order from './pages/Order.jsx'
import Success from './pages/Success.jsx'
import Admin from './pages/Admin.jsx'
import Privacy from './pages/Privacy.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/order" element={<Order />} />
      <Route path="/success" element={<Success />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
