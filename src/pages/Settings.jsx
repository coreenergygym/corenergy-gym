import { useEffect, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabaseClient'

export default function Settings() {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')

  const [adminEmail, setAdminEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    setLoadError('')
    try {
      const [{ data: gymSettings, error: settingsError }, { data: userData }] = await Promise.all([
        supabase.from('gym_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.auth.getUser(),
      ])
      if (settingsError) throw settingsError
      setForm({
        gym_name: gymSettings?.gym_name || '',
        contact_number: gymSettings?.contact_number || '',
        whatsapp_number: gymSettings?.whatsapp_number || '',
        address: gymSettings?.address || '',
        expiring_soon_days: gymSettings?.expiring_soon_days ?? 7,
      })
      setAdminEmail(userData?.user?.email || '')
    } catch (err) {
      setLoadError('Could not load settings. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings(e) {
    e.preventDefault()
    setSaveMessage('')
    setSaveError('')

    if (!form.gym_name.trim()) {
      setSaveError('Gym name is required.')
      return
    }
    const days = Number(form.expiring_soon_days)
    if (!Number.isFinite(days) || days < 1) {
      setSaveError('Expiring Soon threshold must be at least 1 day.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('gym_settings')
        .update({
          gym_name: form.gym_name.trim(),
          contact_number: form.contact_number.trim() || null,
          whatsapp_number: form.whatsapp_number.trim() || null,
          address: form.address.trim() || null,
          expiring_soon_days: days,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1)
      if (error) throw error
      setSaveMessage('Settings saved.')
    } catch (err) {
      setSaveError(err.message || 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    setPasswordMessage('')
    setPasswordError('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Fill in all three password fields.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setPasswordSaving(true)
    try {
      // Confirm identity by re-checking the current password before
      // allowing a change — a normal login call, not a new session.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: currentPassword,
      })
      if (reauthError) {
        setPasswordError('Current password is incorrect.')
        setPasswordSaving(false)
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
  password: newPassword,
  current_password: currentPassword,
})
      if (updateError) throw updateError

      setPasswordMessage('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err.message || 'Could not update password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) {
    return <AdminLayout title="Settings"><p>Loading settings…</p></AdminLayout>
  }

  if (loadError || !form) {
    return <AdminLayout title="Settings"><div className="form-error-banner">{loadError}</div></AdminLayout>
  }

  return (
    <AdminLayout title="Settings">
      <div className="profile-grid">
        <form className="card" onSubmit={saveSettings}>
          <div className="form-section-title" style={{ marginTop: 0 }}>Gym Information</div>

          {saveError && <div className="form-error-banner">{saveError}</div>}
          {saveMessage && <div className="form-error-banner" style={{ background: '#e5f3ea', color: '#2f8f4e' }}>{saveMessage}</div>}

          <div className="field">
            <label>Gym Name</label>
            <input
              required
              value={form.gym_name}
              onChange={(e) => setForm((f) => ({ ...f, gym_name: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Contact Number</label>
            <input
              value={form.contact_number}
              onChange={(e) => setForm((f) => ({ ...f, contact_number: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>WhatsApp Number</label>
            <input
              value={form.whatsapp_number}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp_number: e.target.value }))}
              placeholder="e.g. 919876543210"
            />
          </div>
          <div className="field">
            <label>Address</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>"Expiring Soon" Threshold (days)</label>
            <input
              type="number"
              min="1"
              required
              value={form.expiring_soon_days}
              onChange={(e) => setForm((f) => ({ ...f, expiring_soon_days: e.target.value }))}
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </form>

        <form className="card" onSubmit={changePassword}>
          <div className="form-section-title" style={{ marginTop: 0 }}>Admin Password</div>

          {passwordError && <div className="form-error-banner">{passwordError}</div>}
          {passwordMessage && <div className="form-error-banner" style={{ background: '#e5f3ea', color: '#2f8f4e' }}>{passwordMessage}</div>}

          <div className="field">
            <label>Admin Email</label>
            <input value={adminEmail} disabled />
          </div>
          <div className="field">
            <label>Current Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label>New Password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Confirm New Password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={passwordSaving}>
            {passwordSaving ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </AdminLayout>
  )
}
