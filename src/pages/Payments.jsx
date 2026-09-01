import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabaseClient'
import { computeDue } from '../lib/status'
import { formatDateDisplay, todayISO } from '../lib/dateUtils'
import { formatRupees } from '../lib/format'

const METHODS = ['All', 'Cash', 'UPI', 'Bank Transfer', 'Other']

export default function Payments() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [method, setMethod] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)

  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    loadPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, dateFrom, dateTo])

  async function loadPayments() {
    setLoading(true)
    setLoadError('')
    try {
      let query = supabase
        .from('payments')
        .select('*, member:members(id, full_name, member_code, mobile), membership:memberships(id, plan, fee)')
        .order('payment_date', { ascending: false })
        .limit(500)

      if (dateFrom) query = query.gte('payment_date', dateFrom)
      if (dateTo) query = query.lte('payment_date', dateTo)
      if (method !== 'All') query = query.eq('method', method)

      const { data: paymentRows, error } = await query
      if (error) throw error

      // Recalculate "due" using EVERY payment against each membership
      // (not just the ones in this filtered window), so the due shown
      // here always matches the member profile.
      const membershipIds = [...new Set((paymentRows || []).map((p) => p.membership_id))]
      let paidByMembership = new Map()
      if (membershipIds.length) {
        const { data: allPaymentsForThese, error: sumError } = await supabase
          .from('payments')
          .select('membership_id, amount')
          .in('membership_id', membershipIds)
        if (sumError) throw sumError
        for (const p of allPaymentsForThese || []) {
          paidByMembership.set(p.membership_id, (paidByMembership.get(p.membership_id) || 0) + Number(p.amount))
        }
      }

      const combined = (paymentRows || []).map((p) => {
        const totalPaid = paidByMembership.get(p.membership_id) || 0
        const due = p.membership ? computeDue(p.membership.fee, totalPaid) : 0
        return { ...p, due }
      })

      setRows(combined)
    } catch (err) {
      setLoadError('Could not load payments. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) => {
      const m = r.member
      if (!m) return false
      return (
        m.full_name?.toLowerCase().includes(term) ||
        m.mobile?.toLowerCase().includes(term) ||
        m.member_code?.toLowerCase().includes(term)
      )
    })
  }, [rows, searchTerm])

  const totalReceived = filtered.reduce((sum, r) => sum + Number(r.amount), 0)

  // ---------- Edit / delete ----------

  function startEdit(payment) {
    setActionError('')
    setEditingId(payment.id)
    setEditDraft({
      amount: payment.amount,
      payment_date: payment.payment_date,
      method: payment.method || '',
      notes: payment.notes || '',
    })
  }

  async function saveEdit(paymentId) {
    setActionError('')
    const amount = Number(editDraft.amount)
    if (!amount || amount <= 0) {
      setActionError('Enter a valid payment amount.')
      return
    }
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          amount,
          payment_date: editDraft.payment_date,
          method: editDraft.method || null,
          notes: editDraft.notes.trim() || null,
        })
        .eq('id', paymentId)
      if (error) throw error
      setEditingId(null)
      await loadPayments()
    } catch (err) {
      setActionError(err.message || 'Could not update this payment.')
    }
  }

  async function deletePayment(payment) {
    const confirmed = window.confirm(
      `Delete this payment of ${formatRupees(payment.amount)} dated ${formatDateDisplay(payment.payment_date)} for ${payment.member?.full_name || 'this member'}? This cannot be undone.`
    )
    if (!confirmed) return
    setActionError('')
    try {
      const { error } = await supabase.from('payments').delete().eq('id', payment.id)
      if (error) throw error
      await loadPayments()
    } catch (err) {
      setActionError(err.message || 'Could not delete this payment.')
    }
  }

  return (
    <AdminLayout title="Payments">
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Money Received (this view)</div>
          <div className="stat-value">{formatRupees(totalReceived)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Payments Shown</div>
          <div className="stat-value">{filtered.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Money Due</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>
            <Link to="/admin/members" state={{ filter: 'Unpaid' }}>See unpaid members →</Link>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="🔎 Search by member name, mobile, or Member ID…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>➕ Add Payment</button>
      </div>

      <div className="toolbar">
        {METHODS.map((m) => (
          <button key={m} className={`filter-chip ${method === m ? 'active' : ''}`} onClick={() => setMethod(m)}>
            {m}
          </button>
        ))}
        <div className="field" style={{ marginBottom: 0, width: 160 }}>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date" />
        </div>
        <div className="field" style={{ marginBottom: 0, width: 160 }}>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date" />
        </div>
        {(dateFrom || dateTo) && (
          <button className="icon-btn" onClick={() => { setDateFrom(''); setDateTo('') }}>Clear dates</button>
        )}
      </div>

      {actionError && <div className="form-error-banner">{actionError}</div>}
      {loadError && <div className="form-error-banner">{loadError}</div>}

      {loading ? (
        <p>Loading payments…</p>
      ) : filtered.length === 0 ? (
        <div className="card">No payments match this view yet.</div>
      ) : (
        <div className="member-table-wrap">
          <table className="member-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Membership</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Due After</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  {editingId === p.id ? (
                    <>
                      <td>
                        <input type="date" value={editDraft.payment_date} onChange={(e) => setEditDraft((d) => ({ ...d, payment_date: e.target.value }))} />
                      </td>
                      <td>{p.member ? `${p.member.full_name} (${p.member.member_code})` : '—'}</td>
                      <td>{p.membership?.plan || '—'}</td>
                      <td>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          style={{ width: 100 }}
                          value={editDraft.amount}
                          onChange={(e) => setEditDraft((d) => ({ ...d, amount: e.target.value }))}
                        />
                      </td>
                      <td>
                        <select value={editDraft.method} onChange={(e) => setEditDraft((d) => ({ ...d, method: e.target.value }))}>
                          <option value="">Select…</option>
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Other">Other</option>
                        </select>
                      </td>
                      <td colSpan={2}>
                        <div className="payment-line-actions">
                          <button className="icon-btn" onClick={() => saveEdit(p.id)}>Save</button>
                          <button className="icon-btn" onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{formatDateDisplay(p.payment_date)}</td>
                      <td>
                        {p.member ? (
                          <Link className="row-link" to={`/admin/members/${p.member.id}`}>
                            {p.member.full_name}
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 500 }}>{p.member.member_code}</div>
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{p.membership?.plan || '—'}</td>
                      <td>{formatRupees(p.amount)}</td>
                      <td>{p.method || '—'}</td>
                      <td>{formatRupees(p.due)}</td>
                      <td>
                        <div className="payment-line-actions">
                          <button className="icon-btn" onClick={() => startEdit(p)}>Edit</button>
                          <button className="icon-btn" onClick={() => deletePayment(p)}>Delete</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <AddPaymentModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false)
            loadPayments()
          }}
        />
      )}
    </AdminLayout>
  )
}

// ---------- Add Payment modal: search a member, pick their current
// membership, record a payment against it. ----------
function AddPaymentModal({ onClose, onSaved }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [currentMembership, setCurrentMembership] = useState(null)
  const [loadingMembership, setLoadingMembership] = useState(false)
  const [form, setForm] = useState({ amount: '', date: todayISO(), method: '', notes: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const term = searchTerm.trim()
    if (!term) {
      setResults([])
      return
    }
    setSearching(true)
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('members')
        .select('id, full_name, member_code, mobile')
        .or(`full_name.ilike.%${term}%,mobile.ilike.%${term}%,member_code.ilike.%${term}%`)
        .limit(10)
      setResults(data || [])
      setSearching(false)
    }, 250)
    return () => clearTimeout(timeout)
  }, [searchTerm])

  async function selectMember(member) {
    setSelectedMember(member)
    setResults([])
    setSearchTerm('')
    setLoadingMembership(true)
    const { data } = await supabase
      .from('memberships')
      .select('id, plan, fee, start_date, expiry_date')
      .eq('member_id', member.id)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    setCurrentMembership(data || null)
    setLoadingMembership(false)
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      setError('Enter a valid payment amount.')
      return
    }
    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('payments').insert({
        member_id: selectedMember.id,
        membership_id: currentMembership.id,
        amount,
        payment_date: form.date,
        purpose: 'Membership',
        method: form.method || null,
        notes: form.notes.trim() || null,
      })
      if (insertError) throw insertError
      onSaved()
    } catch (err) {
      setError(err.message || 'Could not save the payment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="form-section-title" style={{ marginTop: 0 }}>Add Payment</div>

        {error && <div className="form-error-banner">{error}</div>}

        {!selectedMember ? (
          <>
            <div className="field">
              <label>Search Member</label>
              <input
                autoFocus
                placeholder="Name, mobile, or Member ID…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {searching && <p style={{ color: 'var(--muted)' }}>Searching…</p>}
            {results.map((m) => (
              <button
                key={m.id}
                type="button"
                className="btn btn-secondary btn-block"
                style={{ justifyContent: 'flex-start', marginBottom: 8 }}
                onClick={() => selectMember(m)}
              >
                {m.full_name} — {m.member_code} · {m.mobile}
              </button>
            ))}
            <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          </>
        ) : loadingMembership ? (
          <p>Loading membership…</p>
        ) : !currentMembership ? (
          <>
            <p>{selectedMember.full_name} does not have a membership on record yet.</p>
            <button className="btn btn-secondary" type="button" onClick={onClose}>Close</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="summary-box">
              <div className="summary-row"><span>Member</span><span>{selectedMember.full_name} ({selectedMember.member_code})</span></div>
              <div className="summary-row"><span>Membership</span><span>{currentMembership.plan}</span></div>
              <div className="summary-row"><span>Fee</span><span>{formatRupees(currentMembership.fee)}</span></div>
            </div>
            <div className="field">
              <label>Amount (₹)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                autoFocus
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Payment Date</label>
              <input type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="field">
              <label>Method</label>
              <select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
                <option value="">Select…</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="field">
              <label>Notes</label>
              <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Payment'}</button>
              <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
