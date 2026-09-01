import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess('Password changed successfully! You can now log in.')

    setTimeout(() => {
      navigate('/admin/login', { replace: true })
    }, 2000)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 className="auth-brand">Reset Password</h2>
        <p className="auth-subtitle">
          CoreEnergy The Gym — choose a new password
        </p>

        {error && <div className="form-error-banner">{error}</div>}

        {success && (
          <div
            className="form-error-banner"
            style={{ background: '#e5f3ea', color: '#2f8f4e' }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>New password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="field">
            <label>Confirm new password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
