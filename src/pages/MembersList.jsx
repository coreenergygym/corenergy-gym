import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { MembershipStatusPill, PaymentStatusPill } from '../components/StatusPill'
import { supabase } from '../lib/supabaseClient'
import { useGymSettings } from '../hooks/useGymSettings'
import { computeMembershipStatus, computeDue } from '../lib/status'
import { formatDateDisplay } from '../lib/dateUtils'

const FILTERS = ['All', 'Active', 'Expired', 'Expiring Soon', 'Paid', 'Unpaid', 'Recently Joined']

export default function MembersList() {
  const { settings } = useGymSettings()
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState(location.state?.filter && FILTERS.includes(location.state.filter) ? location.state.filter : 'All')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const timeout = setTimeout(loadMembers, 250) // small debounce while typing
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  async function loadMembers() {
    setLoading(true)
    setLoadError('')
    try {
      let query = supabase.from('members').select('*').order('created_at', { ascending: false }).limit(300)

      const term = searchTerm.trim()
      if (term) {
        query = query.or(`full_name.ilike.%${term}%,mobile.ilike.%${term}%,member_code.ilike.%${term}%`)
      }

      const { data: members, error: membersError } = await query
      if (membersError) throw membersError

      const memberIds = (members || []).map((m) => m.id)

      const { data: memberships, error: membershipsError } = memberIds.length
        ? await supabase.from('memberships').select('id, member_id, plan, start_date, expiry_date, fee').in('member_id', memberIds)
        : { data: [] }
      if (membershipsError) throw membershipsError

      const membershipIds = (memberships || []).map((m) => m.id)
      let allPayments = []
      if (membershipIds.length) {
        const { data, error } = await supabase.from('payments').select('membership_id, amount').in('membership_id', membershipIds)
        if (error) throw error
        allPayments = data || []
      }

      const paidByMembership = new Map()
      for (const p of allPayments) {
        paidByMembership.set(p.membership_id, (paidByMembership.get(p.membership_id) || 0) + Number(p.amount))
      }

      const latestByMember = new Map()
      for (const m of memberships || []) {
        const existing = latestByMember.get(m.member_id)
        if (!existing || new Date(m.start_date) > new Date(existing.start_date)) {
          latestByMember.set(m.member_id, m)
        }
      }

      // Signed URLs for photo thumbnails (private bucket — no public links).
      const withPhotos = (members || []).filter((m) => m.photo_path)
      const signedUrls = new Map()
      if (withPhotos.length) {
        await Promise.all(
          withPhotos.map(async (m) => {
            const { data } = await supabase.storage.from('member-photos').createSignedUrl(m.photo_path, 3600)
            if (data?.signedUrl) signedUrls.set(m.id, data.signedUrl)
          })
        )
      }

      const combined = (members || []).map((member) => {
        const membership = latestByMember.get(member.id) || null
        const paid = membership ? paidByMembership.get(membership.id) || 0 : 0
        const due = membership ? computeDue(membership.fee, paid) : 0
        const status = membership ? computeMembershipStatus(membership.expiry_date, settings.expiring_soon_days) : null
        return { member, membership, paid, due, status, photoUrl: signedUrls.get(member.id) || null }
      })

      setRows(combined)
    } catch (err) {
      setLoadError('Could not load members. Please refresh.')
    } finally {
      setLoading(false)
    }
  }
  async function handleDeleteMember(row) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently remove ${row.member.full_name}? This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      const memberId = row.member.id
      const photoPath = row.member.photo_path

      // Get all memberships of this member
      const { data: memberships, error: membershipsError } = await supabase
        .from('memberships')
        .select('id')
        .eq('member_id', memberId)

      if (membershipsError) throw membershipsError

      const membershipIds = (memberships || []).map((m) => m.id)

      // Delete payments first
      if (membershipIds.length > 0) {
        const { error: paymentsError } = await supabase
          .from('payments')
          .delete()
          .in('membership_id', membershipIds)

        if (paymentsError) throw paymentsError
      }

      // Delete memberships
      const { error: deleteMembershipsError } = await supabase
        .from('memberships')
        .delete()
        .eq('member_id', memberId)

      if (deleteMembershipsError) throw deleteMembershipsError

      // Delete member
      const { error: deleteMemberError } = await supabase
        .from('members')
        .delete()
        .eq('id', memberId)

      if (deleteMemberError) throw deleteMemberError

      // Delete member photo if available
      if (photoPath) {
        await supabase.storage
          .from('member-photos')
          .remove([photoPath])
      }

      // Refresh members list
      await loadMembers()

      alert(`${row.member.full_name} has been removed successfully.`)
    } catch (err) {
      console.error(err)
      alert('Could not remove this member. Please try again.')
    }
  }
  const filtered = useMemo(() => {
    switch (filter) {
      case 'Active':
        return rows.filter((r) => r.status === 'active' || r.status === 'expiring')
      case 'Expired':
        return rows.filter((r) => r.status === 'expired')
      case 'Expiring Soon':
        return rows.filter((r) => r.status === 'expiring')
      case 'Paid':
        return rows.filter((r) => r.due <= 0)
      case 'Unpaid':
        return rows.filter((r) => r.due > 0)
      case 'Recently Joined': {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 30)
        return rows.filter((r) => new Date(r.member.created_at) >= cutoff)
      }
      default:
        return rows
    }
  }, [rows, filter])

  return (
    <AdminLayout title="Members">
      <div className="toolbar">
        <input
          className="search-input"
          placeholder="🔎 Search by name, mobile, or Member ID…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Link className="btn btn-primary" to="/admin/members/add">➕ Add New Member</Link>
      </div>

      <div className="toolbar">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loadError && <div className="form-error-banner">{loadError}</div>}

      {loading ? (
        <p>Loading members…</p>
      ) : filtered.length === 0 ? (
        <div className="card">No members match this view yet.</div>
      ) : (
        <div className="member-table-wrap">
          <table className="member-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Mobile</th>
                <th>Plan</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.member.id}>
                  <td>
                    <Link className="row-link" to={`/admin/members/${r.member.id}`}>
                      {r.photoUrl ? (
                        <img className="avatar" src={r.photoUrl} alt="" />
                      ) : (
                        <span className="avatar">{r.member.full_name.slice(0, 1).toUpperCase()}</span>
                      )}
                      <span>
                        {r.member.full_name}
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 500 }}>{r.member.member_code}</div>
                      </span>
                    </Link>
                  </td>
                  <td>{r.member.mobile}</td>
                  <td>{r.membership?.plan || '—'}</td>
                  <td>{r.membership ? formatDateDisplay(r.membership.expiry_date) : '—'}</td>
                  <td>{r.status ? <MembershipStatusPill status={r.status} /> : '—'}</td>
                  <td>{r.membership ? <PaymentStatusPill due={r.due} /> : '—'}</td>
                  <td>
  <button
    className="btn btn-danger"
    onClick={() => handleDeleteMember(r)}
  >
    🗑️ Remove
  </button>
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
