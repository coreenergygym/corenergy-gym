import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import BarChart from '../components/BarChart'
import { supabase } from '../lib/supabaseClient'
import { useGymSettings } from '../hooks/useGymSettings'
import { formatRupees } from '../lib/format'
import { todayISO } from '../lib/dateUtils'
import {
  monthRangeISO,
  yearRangeISO,
  periodStats,
  yearlyMonthBreakdown,
  currentPlanDistribution,
} from '../lib/statistics'

const now = new Date()

export default function Statistics() {
  const { settings } = useGymSettings()
  const [mode, setMode] = useState('monthly') // 'monthly' | 'yearly'
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const [members, setMembers] = useState([])
  const [memberships, setMemberships] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setLoadError('')
    try {
      const [{ data: membersData, error: mErr }, { data: membershipsData, error: msErr }, { data: paymentsData, error: pErr }] =
        await Promise.all([
          supabase.from('members').select('id, created_at'),
          supabase
            .from('memberships')
            .select('id, member_id, plan, start_date, expiry_date, fee, renewed_from_membership_id, created_at'),
          supabase.from('payments').select('membership_id, amount, payment_date'),
        ])
      if (mErr) throw mErr
      if (msErr) throw msErr
      if (pErr) throw pErr
      setMembers(membersData || [])
      setMemberships(membershipsData || [])
      setPayments(paymentsData || [])
    } catch (err) {
      setLoadError('Could not load statistics. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  const today = todayISO()
  const expiringSoonDays = settings.expiring_soon_days

  const monthly = useMemo(() => {
    const { startISO, endISO } = monthRangeISO(year, month)
    return periodStats({ members, memberships, payments, startISO, endISO, expiringSoonDays, todayISO: today })
  }, [members, memberships, payments, year, month, expiringSoonDays, today])

  const yearly = useMemo(() => {
    const { startISO, endISO } = yearRangeISO(year)
    const summary = periodStats({ members, memberships, payments, startISO, endISO, expiringSoonDays, todayISO: today })
    const breakdown = yearlyMonthBreakdown({ members, memberships, payments, year, expiringSoonDays, todayISO: today })
    const totalExpired = breakdown.reduce((s, r) => s + r.expired, 0)
    return { summary, breakdown, totalExpired }
  }, [members, memberships, payments, year, expiringSoonDays, today])

  const planDistribution = useMemo(() => currentPlanDistribution(members, memberships), [members, memberships])

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i, 1).toLocaleDateString('en-IN', { month: 'long' }),
  }))
  const currentYear = now.getFullYear()
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i)

  if (loading) {
    return <AdminLayout title="Statistics"><p>Loading statistics…</p></AdminLayout>
  }

  return (
    <AdminLayout title="Statistics">
      {loadError && <div className="form-error-banner">{loadError}</div>}

      <div className="toolbar">
        <button className={`filter-chip ${mode === 'monthly' ? 'active' : ''}`} onClick={() => setMode('monthly')}>Monthly</button>
        <button className={`filter-chip ${mode === 'yearly' ? 'active' : ''}`} onClick={() => setMode('yearly')}>Yearly</button>
      </div>

      {mode === 'monthly' ? (
        <>
          <div className="toolbar">
            <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0, minWidth: 110 }}>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="stat-grid">
            <StatCard label="New Members" value={monthly.newMembers} />
            <StatCard label="Active Members" value={monthly.activeMembers} />
            <StatCard label="Memberships Expired" value={monthly.expiredInPeriod} />
            <StatCard label="Renewals" value={monthly.renewals} />
            <StatCard label="Total Payments Recorded" value={formatRupees(monthly.totalPaymentsRecorded)} />
            <StatCard label="Total Revenue" value={formatRupees(monthly.revenue)} />
            <StatCard label="Total Due Amount (current, all members)" value={formatRupees(monthly.totalDue)} />
          </div>

          <div className="section-heading">Membership Plan Breakdown — new/renewed this month</div>
          {monthly.planBreakdown.length === 0 ? (
            <div className="card">No membership activity recorded for this month yet.</div>
          ) : (
            <div className="card">
              {monthly.planBreakdown.map((p) => (
                <div className="detail-row" key={p.plan}>
                  <span>{p.plan}</span>
                  <span>{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="toolbar">
            <div className="field" style={{ marginBottom: 0, minWidth: 110 }}>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="stat-grid">
            <StatCard label="Total New Members" value={yearly.summary.newMembers} />
            <StatCard label="Total Renewals" value={yearly.summary.renewals} />
            <StatCard label="Total Revenue" value={formatRupees(yearly.summary.revenue)} />
            <StatCard label="Total Payments Recorded" value={formatRupees(yearly.summary.totalPaymentsRecorded)} />
            <StatCard label="Total Expired Memberships" value={yearly.totalExpired} />
            <StatCard label="Total Due Amount (current, all members)" value={formatRupees(yearly.summary.totalDue)} />
          </div>

          <div className="section-heading">Month-by-Month Breakdown — {year}</div>
          <div className="member-table-wrap" style={{ marginBottom: 28 }}>
            <table className="member-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>New Members</th>
                  <th>Renewals</th>
                  <th>Revenue</th>
                  <th>Expired</th>
                </tr>
              </thead>
              <tbody>
                {yearly.breakdown.map((r) => (
                  <tr key={r.month}>
                    <td>{r.monthLabel}</td>
                    <td>{r.newMembers}</td>
                    <td>{r.renewals}</td>
                    <td>{formatRupees(r.revenue)}</td>
                    <td>{r.expired}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-heading">Monthly Revenue</div>
          <div className="card" style={{ marginBottom: 24 }}>
            <BarChart
              data={yearly.breakdown.map((r) => ({ label: r.monthLabel, value: r.revenue }))}
              formatValue={(v) => `₹${Math.round(v).toLocaleString('en-IN')}`}
            />
          </div>

          <div className="section-heading">New Members by Month</div>
          <div className="card" style={{ marginBottom: 24 }}>
            <BarChart
              data={yearly.breakdown.map((r) => ({ label: r.monthLabel, value: r.newMembers }))}
              color="var(--accent-2)"
            />
          </div>

          <div className="profile-grid">
            <div>
              <div className="section-heading" style={{ marginTop: 0 }}>Active vs Expired Members (current)</div>
              <div className="card">
                <BarChart
                  data={[
                    { label: 'Active', value: yearly.summary.activeMembers },
                    { label: 'Expired', value: yearly.summary.currentlyExpiredAsOfEnd },
                  ]}
                  color="var(--status-active)"
                />
              </div>
            </div>
            <div>
              <div className="section-heading" style={{ marginTop: 0 }}>Membership Plan Distribution (current)</div>
              <div className="card">
                <BarChart
                  data={planDistribution.map((p) => ({ label: p.plan, value: p.count }))}
                  color="var(--accent-2)"
                  emptyLabel="No active memberships yet"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: '1.5rem' }}>{value}</div>
    </div>
  )
}
