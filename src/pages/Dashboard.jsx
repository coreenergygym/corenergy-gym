import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabaseClient'

const EMPTY_STATS = {
  totalMembers: 0,
  activeMembers: 0,
  expiredMembers: 0,
  newMembersThisMonth: 0,
  expiringSoon: 0,
  totalRevenue: 0,
  totalDue: 0,
}

function startOfMonthISO() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default function Dashboard() {
  const [stats, setStats] = useState(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    setLoadError('')

    try {
      const [{ data: settings }, { count: totalMembers }, { data: newMembers }, { data: memberships }, { data: payments }] =
        await Promise.all([
          supabase.from('gym_settings').select('expiring_soon_days').eq('id', 1).maybeSingle(),
          supabase.from('members').select('id', { count: 'exact', head: true }),
          supabase.from('members').select('id').gte('created_at', startOfMonthISO()),
          // member_id + expiry/fee is all the dashboard needs, keeps the payload small
          supabase.from('memberships').select('id, member_id, start_date, expiry_date, fee'),
          supabase.from('payments').select('membership_id, amount'),
        ])

      const expiringSoonDays = settings?.expiring_soon_days ?? 7
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const soonCutoff = new Date(today)
      soonCutoff.setDate(soonCutoff.getDate() + expiringSoonDays)

      // Pick each member's CURRENT membership = the one with the latest start_date.
      const latestByMember = new Map()
      for (const m of memberships || []) {
        const existing = latestByMember.get(m.member_id)
        if (!existing || new Date(m.start_date) > new Date(existing.start_date)) {
          latestByMember.set(m.member_id, m)
        }
      }

      // Sum payments per membership so we can work out due amount per member.
      const paidByMembership = new Map()
      for (const p of payments || []) {
        paidByMembership.set(p.membership_id, (paidByMembership.get(p.membership_id) || 0) + Number(p.amount))
      }

      let activeMembers = 0
      let expiredMembers = 0
      let expiringSoon = 0
      let totalDue = 0

      for (const membership of latestByMember.values()) {
        const expiry = new Date(membership.expiry_date)
        expiry.setHours(0, 0, 0, 0)

        if (expiry < today) {
          expiredMembers += 1
        } else {
          activeMembers += 1
          if (expiry <= soonCutoff) expiringSoon += 1
        }

        const paid = paidByMembership.get(membership.id) || 0
        const due = Math.max(0, Number(membership.fee) - paid)
        totalDue += due
      }

      const totalRevenue = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)

      setStats({
        totalMembers: totalMembers || 0,
        activeMembers,
        expiredMembers,
        newMembersThisMonth: (newMembers || []).length,
        expiringSoon,
        totalRevenue,
        totalDue,
      })
    } catch (err) {
      setLoadError('Could not load dashboard data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  const cards = [
    { label: 'Total Members', value: stats.totalMembers },
    { label: 'Active Members', value: stats.activeMembers },
    { label: 'Expired Members', value: stats.expiredMembers },
    { label: 'New Members (this month)', value: stats.newMembersThisMonth },
    { label: 'Expiring Soon', value: stats.expiringSoon },
    { label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString('en-IN')}` },
    { label: 'Total Amount Paid', value: `₹${stats.totalRevenue.toLocaleString('en-IN')}` },
    { label: 'Total Due Amount', value: `₹${stats.totalDue.toLocaleString('en-IN')}` },
  ]

  return (
    <AdminLayout title="Dashboard">
      <div className="quick-actions">
        <Link className="btn btn-primary" to="/admin/members/add">➕ Add New Member</Link>
        <Link className="btn btn-secondary" to="/admin/members">👥 Members</Link>
        <Link className="btn btn-secondary" to="/admin/payments">💰 Payments</Link>
        <Link className="btn btn-secondary" to="/admin/statistics">📊 Statistics</Link>
        <Link className="btn btn-secondary" to="/admin/settings">⚙️ Settings</Link>
      </div>

      {loadError && <div className="form-error-banner">{loadError}</div>}

      {loading ? (
        <p>Loading dashboard…</p>
      ) : (
        <div className="stat-grid">
          {cards.map((c) => (
            <div className="stat-card" key={c.label}>
              <div className="stat-label">{c.label}</div>
              <div className="stat-value">{c.value}</div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
