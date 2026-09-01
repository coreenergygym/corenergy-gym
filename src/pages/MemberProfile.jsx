import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import PhotoPicker from '../components/PhotoPicker'
import MembershipFields, { defaultMembershipValue } from '../components/MembershipFields'
import WhatsAppButtons from '../components/WhatsAppButtons'
import { MembershipStatusPill, PaymentStatusPill } from '../components/StatusPill'
import { supabase } from '../lib/supabaseClient'
import { useGymSettings } from '../hooks/useGymSettings'
import { computeDue, computeMembershipStatus } from '../lib/status'
import { formatDateDisplay, addDays, todayISO } from '../lib/dateUtils'
import { formatRupees } from '../lib/format'

export default function MemberProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings } = useGymSettings()

  const [member, setMember] = useState(null)
  const [memberships, setMemberships] = useState([]) // sorted latest first
  const [payments, setPayments] = useState([])
  const [photoUrl, setPhotoUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [editingPersonal, setEditingPersonal] = useState(false)
  const [personalDraft, setPersonalDraft] = useState(null)
  const [newPhotoBlob, setNewPhotoBlob] = useState(null)
  const [savingPersonal, setSavingPersonal] = useState(false)

  const [showRenewal, setShowRenewal] = useState(false)
  const [renewalValue, setRenewalValue] = useState(null)
  const [savingRenewal, setSavingRenewal] = useState(false)

  const [showAddPayment, setShowAddPayment] = useState(false)
  const [addPaymentForm, setAddPaymentForm] = useState({ amount: '', date: todayISO(), method: '', notes: '' })
  const [savingPayment, setSavingPayment] = useState(false)

  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [editPaymentDraft, setEditPaymentDraft] = useState(null)

  const [actionError, setActionError] = useState('')

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadAll() {
    setLoading(true)
    setLoadError('')
    try {
      const { data: memberData, error: memberError } = await supabase.from('members').select('*').eq('id', id).single()
      if (memberError) throw memberError

      const { data: membershipData, error: membershipError } = await supabase
        .from('memberships')
        .select('*')
        .eq('member_id', id)
        .order('start_date', { ascending: false })
      if (membershipError) throw membershipError

      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('member_id', id)
        .order('payment_date', { ascending: false })
      if (paymentError) throw paymentError

      setMember(memberData)
      setMemberships(membershipData || [])
      setPayments(paymentData || [])

      if (memberData.photo_path) {
        const { data } = await supabase.storage.from('member-photos').createSignedUrl(memberData.photo_path, 3600)
        setPhotoUrl(data?.signedUrl || null)
      } else {
        setPhotoUrl(null)
      }
    } catch (err) {
      setLoadError('Could not load this member. Please go back and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <AdminLayout title="Member Profile"><p>Loading…</p></AdminLayout>
  }

  if (loadError || !member) {
    return <AdminLayout title="Member Profile"><div className="form-error-banner">{loadError || 'Member not found.'}</div></AdminLayout>
  }

  const currentMembership = memberships[0] || null
  const pastMemberships = memberships.slice(1)

  const paymentsForMembership = (membershipId) => payments.filter((p) => p.membership_id === membershipId)
  const totalPaidFor = (membershipId) => paymentsForMembership(membershipId).reduce((s, p) => s + Number(p.amount), 0)

  const currentPaid = currentMembership ? totalPaidFor(currentMembership.id) : 0
  const currentDue = currentMembership ? computeDue(currentMembership.fee, currentPaid) : 0
  const currentStatus = currentMembership ? computeMembershipStatus(currentMembership.expiry_date, settings.expiring_soon_days) : null
  const latestPayment = currentMembership ? paymentsForMembership(currentMembership.id)[0] || null : null

  // ---------- Edit personal info ----------

  function startEditPersonal() {
    setPersonalDraft({
      full_name: member.full_name || '',
      mobile: member.mobile || '',
      alt_mobile: member.alt_mobile || '',
      date_of_birth: member.date_of_birth || '',
      gender: member.gender || '',
      address: member.address || '',
      emergency_contact: member.emergency_contact || '',
      notes: member.notes || '',
    })
    setNewPhotoBlob(null)
    setEditingPersonal(true)
  }

  async function saveEditPersonal(e) {
    e.preventDefault()
    setActionError('')
    setSavingPersonal(true)
    try {
      let photoPath = member.photo_path
      if (newPhotoBlob) {
        const path = `${member.id}/${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('member-photos')
          .upload(path, newPhotoBlob, { contentType: 'image/jpeg', upsert: true })
        if (uploadError) throw uploadError
        photoPath = path
      }

      const { error } = await supabase
        .from('members')
        .update({
          full_name: personalDraft.full_name.trim(),
          mobile: personalDraft.mobile.trim(),
          alt_mobile: personalDraft.alt_mobile.trim() || null,
          date_of_birth: personalDraft.date_of_birth || null,
          gender: personalDraft.gender || null,
          address: personalDraft.address.trim() || null,
          emergency_contact: personalDraft.emergency_contact.trim() || null,
          notes: personalDraft.notes.trim() || null,
          photo_path: photoPath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', member.id)
      if (error) throw error

      setEditingPersonal(false)
      await loadAll()
    } catch (err) {
      setActionError(err.message || 'Could not save changes.')
    } finally {
      setSavingPersonal(false)
    }
  }

  // ---------- Renewal ----------

  function startRenewal() {
    const base =
      currentMembership && currentStatus !== 'expired'
        ? addDays(currentMembership.expiry_date, 1)
        : todayISO()
    setRenewalValue(defaultMembershipValue(base))
    setShowRenewal(true)
  }

  async function submitRenewal(e) {
    e.preventDefault()
    setActionError('')
    if (!renewalValue.plan.trim() || !renewalValue.fee) {
      setActionError('Plan and fee are required to renew.')
      return
    }
    setSavingRenewal(true)
    try {
      const { data: newMembership, error: membershipError } = await supabase
        .from('memberships')
        .insert({
          member_id: member.id,
          plan: renewalValue.plan.trim(),
          duration_days: renewalValue.durationDays,
          start_date: renewalValue.startDate,
          expiry_date: renewalValue.expiryDate,
          fee: Number(renewalValue.fee),
          notes: renewalValue.notes.trim() || null,
          renewed_from_membership_id: currentMembership?.id || null,
        })
        .select()
        .single()
      if (membershipError) throw membershipError

      const amountPaid = Number(renewalValue.amountPaid) || 0
      if (amountPaid > 0) {
        const { error: paymentError } = await supabase.from('payments').insert({
          member_id: member.id,
          membership_id: newMembership.id,
          amount: amountPaid,
          payment_date: renewalValue.paymentDate,
          purpose: 'Renewal',
          method: renewalValue.method || null,
        })
        if (paymentError) throw paymentError
      }

      setShowRenewal(false)
      await loadAll()
    } catch (err) {
      setActionError(err.message || 'Could not save the renewal.')
    } finally {
      setSavingRenewal(false)
    }
  }

  // ---------- Add payment (top-up against current membership) ----------

  async function submitAddPayment(e) {
    e.preventDefault()
    setActionError('')
    const amount = Number(addPaymentForm.amount)
    if (!amount || amount <= 0) {
      setActionError('Enter a valid payment amount.')
      return
    }
    setSavingPayment(true)
    try {
      const { error } = await supabase.from('payments').insert({
        member_id: member.id,
        membership_id: currentMembership.id,
        amount,
        payment_date: addPaymentForm.date,
        purpose: 'Membership',
        method: addPaymentForm.method || null,
        notes: addPaymentForm.notes.trim() || null,
      })
      if (error) throw error

      setShowAddPayment(false)
      setAddPaymentForm({ amount: '', date: todayISO(), method: '', notes: '' })
      await loadAll()
    } catch (err) {
      setActionError(err.message || 'Could not save the payment.')
    } finally {
      setSavingPayment(false)
    }
  }

  // ---------- Edit / delete a payment ----------

  function startEditPayment(payment) {
    setEditingPaymentId(payment.id)
    setEditPaymentDraft({
      amount: payment.amount,
      payment_date: payment.payment_date,
      method: payment.method || '',
      notes: payment.notes || '',
    })
  }

  async function saveEditPayment(paymentId) {
    setActionError('')
    const amount = Number(editPaymentDraft.amount)
    if (!amount || amount <= 0) {
      setActionError('Enter a valid payment amount.')
      return
    }
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          amount,
          payment_date: editPaymentDraft.payment_date,
          method: editPaymentDraft.method || null,
          notes: editPaymentDraft.notes.trim() || null,
        })
        .eq('id', paymentId)
      if (error) throw error

      setEditingPaymentId(null)
      await loadAll() // due amounts and revenue recalculate automatically from live data
    } catch (err) {
      setActionError(err.message || 'Could not update this payment.')
    }
  }

  async function deletePayment(payment) {
    const confirmed = window.confirm(
      `Delete this payment of ${formatRupees(payment.amount)} dated ${formatDateDisplay(payment.payment_date)}? This cannot be undone.`
    )
    if (!confirmed) return

    setActionError('')
    try {
      const { error } = await supabase.from('payments').delete().eq('id', payment.id)
      if (error) throw error
      await loadAll()
    } catch (err) {
      setActionError(err.message || 'Could not delete this payment.')
    }
  }

  // ---------- Render helpers ----------

  function renderPaymentLine(payment) {
    const isEditing = editingPaymentId === payment.id
    if (isEditing) {
      return (
        <div className="payment-line" key={payment.id} style={{ flexWrap: 'wrap' }}>
          <div className="field-grid" style={{ flex: 1, gap: '8px 12px' }}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Amount (₹)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={editPaymentDraft.amount}
                onChange={(e) => setEditPaymentDraft((d) => ({ ...d, amount: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Date</label>
              <input
                type="date"
                value={editPaymentDraft.payment_date}
                onChange={(e) => setEditPaymentDraft((d) => ({ ...d, payment_date: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Method</label>
              <select
                value={editPaymentDraft.method}
                onChange={(e) => setEditPaymentDraft((d) => ({ ...d, method: e.target.value }))}
              >
                <option value="">Select…</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="payment-line-actions">
            <button className="icon-btn" onClick={() => saveEditPayment(payment.id)}>Save</button>
            <button className="icon-btn" onClick={() => setEditingPaymentId(null)}>Cancel</button>
          </div>
        </div>
      )
    }

    return (
      <div className="payment-line" key={payment.id}>
        <span>
          {formatDateDisplay(payment.payment_date)} — {formatRupees(payment.amount)}
          {payment.method ? ` (${payment.method})` : ''}
          {payment.purpose ? ` · ${payment.purpose}` : ''}
        </span>
        <span className="payment-line-actions">
          <button className="icon-btn" onClick={() => startEditPayment(payment)}>Edit</button>
          <button className="icon-btn" onClick={() => deletePayment(payment)}>Delete</button>
        </span>
      </div>
    )
  }

  return (
    <AdminLayout title="Member Profile">
      <button className="btn btn-secondary" style={{ marginBottom: 20 }} onClick={() => navigate('/admin/members')}>
        ← Back to Members
      </button>

      {actionError && <div className="form-error-banner">{actionError}</div>}

      <div className="profile-header">
        {photoUrl ? (
          <img className="profile-photo" src={photoUrl} alt={member.full_name} />
        ) : (
          <div className="photo-preview-empty" style={{ borderRadius: '50%' }}>{member.full_name.slice(0, 1)}</div>
        )}
        <div>
          <h2 style={{ fontSize: '1.5rem' }}>{member.full_name}</h2>
          <p style={{ margin: 0 }}>{member.member_code} · {member.mobile}</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {!editingPersonal && <button className="btn btn-secondary" onClick={startEditPersonal}>Edit Info</button>}
          <button className="btn btn-primary" onClick={startRenewal}>🔄 Renew Membership</button>
        </div>
      </div>

      {currentMembership && (
        <>
          <div className="section-heading" style={{ marginTop: 0 }}>WhatsApp</div>
          <WhatsAppButtons
            gymName={settings.gym_name}
            member={member}
            membership={currentMembership}
            totalPaid={currentPaid}
            due={currentDue}
            latestPayment={latestPayment}
          />
        </>
      )}

      {/* ---------- Edit personal info form ---------- */}
      {editingPersonal && (
        <form className="card" style={{ marginTop: 20 }} onSubmit={saveEditPersonal}>
          <div className="form-section-title" style={{ marginTop: 0 }}>Edit Personal Details</div>
          <PhotoPicker onPhotoReady={setNewPhotoBlob} />
          <div className="field-grid">
            <div className="field">
              <label>Full Name</label>
              <input value={personalDraft.full_name} onChange={(e) => setPersonalDraft((d) => ({ ...d, full_name: e.target.value }))} />
            </div>
            <div className="field">
              <label>Mobile Number</label>
              <input value={personalDraft.mobile} onChange={(e) => setPersonalDraft((d) => ({ ...d, mobile: e.target.value }))} />
            </div>
            <div className="field">
              <label>Alternate Mobile</label>
              <input value={personalDraft.alt_mobile} onChange={(e) => setPersonalDraft((d) => ({ ...d, alt_mobile: e.target.value }))} />
            </div>
            <div className="field">
              <label>Date of Birth</label>
              <input type="date" value={personalDraft.date_of_birth} onChange={(e) => setPersonalDraft((d) => ({ ...d, date_of_birth: e.target.value }))} />
            </div>
            <div className="field">
              <label>Gender</label>
              <select value={personalDraft.gender} onChange={(e) => setPersonalDraft((d) => ({ ...d, gender: e.target.value }))}>
                <option value="">Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div className="field">
              <label>Emergency Contact</label>
              <input value={personalDraft.emergency_contact} onChange={(e) => setPersonalDraft((d) => ({ ...d, emergency_contact: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label>Address</label>
            <textarea value={personalDraft.address} onChange={(e) => setPersonalDraft((d) => ({ ...d, address: e.target.value }))} />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea value={personalDraft.notes} onChange={(e) => setPersonalDraft((d) => ({ ...d, notes: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" type="submit" disabled={savingPersonal}>{savingPersonal ? 'Saving…' : 'Save Changes'}</button>
            <button className="btn btn-secondary" type="button" onClick={() => setEditingPersonal(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* ---------- Renewal form ---------- */}
      {showRenewal && (
        <form className="card" style={{ marginTop: 20 }} onSubmit={submitRenewal}>
          <div className="form-section-title" style={{ marginTop: 0 }}>Renew Membership</div>
          <MembershipFields value={renewalValue} onChange={setRenewalValue} feeLabel="Renewal Fee" />
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn btn-primary" type="submit" disabled={savingRenewal}>{savingRenewal ? 'Saving…' : 'Save Renewal'}</button>
            <button className="btn btn-secondary" type="button" onClick={() => setShowRenewal(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* ---------- Personal + current membership info ---------- */}
      {!editingPersonal && (
        <div className="profile-grid" style={{ marginTop: 20 }}>
          <div className="card">
            <div className="form-section-title" style={{ marginTop: 0 }}>Personal Information</div>
            <div className="detail-row"><span>Alternate Mobile</span><span>{member.alt_mobile || '—'}</span></div>
            <div className="detail-row"><span>Date of Birth</span><span>{member.date_of_birth ? formatDateDisplay(member.date_of_birth) : '—'}</span></div>
            <div className="detail-row"><span>Gender</span><span>{member.gender || '—'}</span></div>
            <div className="detail-row"><span>Address</span><span>{member.address || '—'}</span></div>
            <div className="detail-row"><span>Emergency Contact</span><span>{member.emergency_contact || '—'}</span></div>
            <div className="detail-row"><span>Notes</span><span>{member.notes || '—'}</span></div>
            <div className="detail-row"><span>Joined</span><span>{formatDateDisplay(member.created_at.slice(0, 10))}</span></div>
          </div>

          <div className="card">
            <div className="form-section-title" style={{ marginTop: 0 }}>Current Membership</div>
            {currentMembership ? (
              <>
                <div className="detail-row"><span>Plan</span><span>{currentMembership.plan}</span></div>
                <div className="detail-row"><span>Start Date</span><span>{formatDateDisplay(currentMembership.start_date)}</span></div>
                <div className="detail-row"><span>Expiry Date</span><span>{formatDateDisplay(currentMembership.expiry_date)}</span></div>
                <div className="detail-row"><span>Status</span><span><MembershipStatusPill status={currentStatus} /></span></div>
                <div className="detail-row"><span>Fee</span><span>{formatRupees(currentMembership.fee)}</span></div>
                <div className="detail-row"><span>Amount Paid</span><span>{formatRupees(currentPaid)}</span></div>
                <div className="detail-row"><span>Due</span><span>{formatRupees(currentDue)}</span></div>
                <div className="detail-row"><span>Payment Status</span><span><PaymentStatusPill due={currentDue} /></span></div>
              </>
            ) : (
              <p>No membership on record yet.</p>
            )}
          </div>
        </div>
      )}

      {/* ---------- Current membership payment history ---------- */}
      {currentMembership && (
        <>
          <div className="section-heading">Payment History — Current Membership</div>
          <div className="history-block">
            <div className="history-block-header">
              <strong>{currentMembership.plan}</strong>
              {!showAddPayment && (
                <button className="btn btn-secondary" onClick={() => setShowAddPayment(true)}>➕ Add Payment</button>
              )}
            </div>

            {showAddPayment && (
              <form onSubmit={submitAddPayment} style={{ marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                <div className="field-grid">
                  <div className="field">
                    <label>Amount (₹)</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={addPaymentForm.amount}
                      onChange={(e) => setAddPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Payment Date</label>
                    <input
                      type="date"
                      required
                      value={addPaymentForm.date}
                      onChange={(e) => setAddPaymentForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Method</label>
                    <select value={addPaymentForm.method} onChange={(e) => setAddPaymentForm((f) => ({ ...f, method: e.target.value }))}>
                      <option value="">Select…</option>
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Notes</label>
                  <input value={addPaymentForm.notes} onChange={(e) => setAddPaymentForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" type="submit" disabled={savingPayment}>{savingPayment ? 'Saving…' : 'Save Payment'}</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setShowAddPayment(false)}>Cancel</button>
                </div>
              </form>
            )}

            {paymentsForMembership(currentMembership.id).length === 0 ? (
              <p style={{ margin: 0, color: 'var(--muted)' }}>No payments recorded yet.</p>
            ) : (
              paymentsForMembership(currentMembership.id).map(renderPaymentLine)
            )}
          </div>
        </>
      )}

      {/* ---------- Membership history ---------- */}
      {pastMemberships.length > 0 && (
        <>
          <div className="section-heading">Membership History</div>
          {pastMemberships.map((m) => {
            const paid = totalPaidFor(m.id)
            const due = computeDue(m.fee, paid)
            return (
              <div className="history-block" key={m.id}>
                <div className="history-block-header">
                  <strong>{m.plan}</strong>
                  <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    {formatDateDisplay(m.start_date)} – {formatDateDisplay(m.expiry_date)}
                  </span>
                </div>
                <div className="detail-row"><span>Fee</span><span>{formatRupees(m.fee)}</span></div>
                <div className="detail-row"><span>Paid</span><span>{formatRupees(paid)}</span></div>
                <div className="detail-row"><span>Due</span><span>{formatRupees(due)}</span></div>
                {paymentsForMembership(m.id).length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {paymentsForMembership(m.id).map(renderPaymentLine)}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </AdminLayout>
  )
}
