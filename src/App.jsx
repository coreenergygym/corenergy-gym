import ResetPassword from './pages/ResetPassword'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PublicSite from './pages/PublicSite'
import AdminSetup from './pages/AdminSetup'
import AdminLogin from './pages/AdminLogin'
import Dashboard from './pages/Dashboard'
import MembersList from './pages/MembersList'
import AddMember from './pages/AddMember'
import MemberProfile from './pages/MemberProfile'
import Payments from './pages/Payments'
import Statistics from './pages/Statistics'
import Settings from './pages/Settings'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public site */}
        <Route path="/" element={<PublicSite />} />

        {/* Auth */}
        <Route path="/admin/setup" element={<AdminSetup />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/reset-password" element={<ResetPassword />} />

        {/* Admin (protected) */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/members"
          element={
            <ProtectedRoute>
              <MembersList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/members/add"
          element={
            <ProtectedRoute>
              <AddMember />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/members/:id"
          element={
            <ProtectedRoute>
              <MemberProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <ProtectedRoute>
              <Payments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/statistics"
          element={
            <ProtectedRoute>
              <Statistics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
