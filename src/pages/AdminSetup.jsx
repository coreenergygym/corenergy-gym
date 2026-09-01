import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function AdminSetup() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [alreadySetUp, setAlreadySetUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase
      .from('system_config')
      .select('setup_completed')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        setAlreadySetUp(!!data?.setup_completed)
        setChecking(false)
      })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message)
      setSubmitting(false)
      return
    }

    // The database trigger securely assigns the first Auth user as admin and
    // locks setup. Do not perform this security-critical step in the browser.

    if (data.session) {
      navigate('/admin/dashboard', { replace: true })
    } else {
      // Project has "confirm email" turned on in Supabase Auth settings.
      setError('Account created. Check your email to confirm it, then log in. Setup is now locked by the database.')
      setSubmitting(false)
    }
  }

  if (checking) {
    return <div className="auth-shell"><p style={{ color: '#fff' }}>Loading…</p></div>
  }

  if (alreadySetUp) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h2 className="auth-brand">Setup already complete</h2>
          <p className="auth-subtitle">
            An admin account already exists for this gym. Go to the normal login page instead.
          </p>
          <Link className="btn btn-primary btn-block" to="/admin/login">Go to Admin Login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 className="auth-brand">Create Admin Account</h2>
        <p className="auth-subtitle">
          One-time setup for CoreEnergy The Gym. This page disables itself
          permanently after you create the account.
        </p>

        {error && <div className="form-error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Admin email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create Admin Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
