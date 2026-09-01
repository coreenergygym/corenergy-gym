import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/admin/members', label: 'Members', icon: '👥' },
  { to: '/admin/members/add', label: 'Add Member', icon: '➕' },
  { to: '/admin/payments', label: 'Payments', icon: '💰' },
  { to: '/admin/statistics', label: 'Statistics', icon: '📊' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
]

export default function AdminLayout({ title, children }) {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">CoreEnergy</div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => 'admin-nav-link' + (isActive ? ' active' : '')}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <button
          className="admin-nav-link"
          style={{ marginTop: 'auto', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          onClick={handleLogout}
        >
          <span aria-hidden="true">🚪</span> Log out
        </button>
      </aside>
      <main className="admin-main">
        <div className="admin-topbar">
          <h1 style={{ fontSize: '1.6rem' }}>{title}</h1>
        </div>
        {children}
      </main>
    </div>
  )
}
