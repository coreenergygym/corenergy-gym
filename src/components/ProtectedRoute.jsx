import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Wrap any admin page with this. If nobody is logged in, it sends
// them back to the login page instead of showing the content.
//
// Note: this is a UX convenience only. The real security is the
// Row Level Security policies in Supabase (see supabase/schema.sql) —
// even if someone bypassed this check, Supabase RLS only allows the
// authorized gym admin to access private data.
export default function ProtectedRoute({ children }) {
  const { isLoading, isLoggedIn } = useAuth()

  if (isLoading) {
    return <div className="auth-shell"><p style={{ color: '#fff' }}>Loading…</p></div>
  }

  if (!isLoggedIn) {
    return <Navigate to="/admin/login" replace />
  }

  return children
}
