import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState('login') // 'login' | 'forgot'

  useEffect(() => {
    // If nobody has ever created an admin account, send the owner to
    // setup instead of showing an empty login form.
    supabase
      .from('system_config')
      .select('setup_completed')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.setup_completed === false) {
          navigate('/admin/setup', { replace: true })
        }
      })
  }, [navigate])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setSubmitting(false)

    if (signInError) {
      setError('Incorrect email or password.')
      return
    }

    navigate('/admin/dashboard', { replace: true })
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    })

    setSubmitting(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setInfo('If that email has an account, a password reset link has been sent.')
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 className="auth-brand">Admin Login</h2>
        <p className="auth-subtitle">CoreEnergy The Gym — staff access only</p>

        {error && <div className="form-error-banner">{error}</div>}
        {info && (
          <div className="form-error-banner" style={{ background: '#e5f3ea', color: '#2f8f4e' }}>
            {info}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="email">Email</label>
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting ? 'Logging in…' : 'Log In'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(''); setInfo('') }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-2)', marginTop: 14, cursor: 'pointer', fontSize: '0.88rem' }}
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword}>
            <div className="field">
              <label htmlFor="resetEmail">Email</label>
              <input
                id="resetEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setInfo('') }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-2)', marginTop: 14, cursor: 'pointer', fontSize: '0.88rem' }}
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
