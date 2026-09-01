// All statistics calculations in one place, so the Dashboard, monthly
// view and yearly view can never disagree about what "Revenue" or
// "New Members" means. Every function takes plain arrays already
// fetched from Supabase — no network calls in here, just math.
//
// Consistent definitions used throughout (see spec section 23-24):
// - New Members: members whose FIRST-EVER membership record was
//   created during the period (uses the membership's created_at).
// - Renewals: membership records created as a renewal
//   (renewed_from_membership_id is set) during the period.
// - Revenue / Total Payments Recorded: sum of payment amounts whose
//   payment_date falls within the period. Due/unpaid amounts are
//   NEVER included.
// - Expired (period): memberships whose expiry_date falls within the
//   period — i.e. membership records that lapsed during that window.
// - Active Members / Total Due Amount: current snapshot figures
//   (evaluated "as of" the end of the period, or right now if the
//   period hasn't ended yet), not period-scoped events.

import { computeDue, computeMembershipStatus } from './status'

export function monthRangeISO(year, month /* 1-12 */) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0) // last day of month
  return { startISO: toISO(start), endISO: toISO(end) }
}

export function yearRangeISO(year) {
  return { startISO: `${year}-01-01`, endISO: `${year}-12-31` }
}

function toISO(d) {
  return d.toISOString().slice(0, 10)
}

function inRange(dateISO, startISO, endISO) {
  return dateISO >= startISO && dateISO <= endISO
}

// Given one member's memberships (any order) and a reference date,
// returns the membership that was "current" as of that date — the
// one with the latest start_date that had already started.
function currentMembershipAsOf(memberships, referenceISO) {
  let current = null
  for (const m of memberships) {
    if (m.start_date > referenceISO) continue
    if (!current || m.start_date > current.start_date) current = m
  }
  return current
}

// Builds the shared per-membership "total paid" map once, reused by
// every calculation below so payments are only summed one time.
function buildPaidMap(payments) {
  const map = new Map()
  for (const p of payments) {
    map.set(p.membership_id, (map.get(p.membership_id) || 0) + Number(p.amount))
  }
  return map
}

// Snapshot: total outstanding due across every member's current
// (latest) membership, evaluated right now. Not period-scoped.
export function currentTotalDue(memberships, paidMap) {
  const latestByMember = new Map()
  for (const m of memberships) {
    const existing = latestByMember.get(m.member_id)
    if (!existing || m.start_date > existing.start_date) latestByMember.set(m.member_id, m)
  }
  let total = 0
  for (const m of latestByMember.values()) {
    total += computeDue(m.fee, paidMap.get(m.id) || 0)
  }
  return total
}

// Snapshot: Active vs Expired member counts as of a reference date
// (defaults to today), used for the "Active vs Expired" chart and the
// monthly view's Active Members card.
export function activeExpiredAsOf(members, memberships, referenceISO, expiringSoonDays) {
  const byMember = new Map()
  for (const m of memberships) {
    if (!byMember.has(m.member_id)) byMember.set(m.member_id, [])
    byMember.get(m.member_id).push(m)
  }
  let active = 0
  let expired = 0
  for (const member of members) {
    const list = byMember.get(member.id) || []
    const current = currentMembershipAsOf(list, referenceISO)
    if (!current) continue
    const status = computeMembershipStatus(current.expiry_date, expiringSoonDays, referenceISO)
    if (status === 'expired') expired += 1
    else active += 1
  }
  return { active, expired }
}

// Core period stats shared by both the monthly and yearly views.
export function periodStats({ members, memberships, payments, startISO, endISO, expiringSoonDays, todayISO }) {
  const paidMap = buildPaidMap(payments)

  const firstMembershipByMember = new Map()
  for (const m of memberships) {
    const existing = firstMembershipByMember.get(m.member_id)
    if (!existing || m.created_at < existing.created_at) firstMembershipByMember.set(m.member_id, m)
  }

  let newMembers = 0
  for (const first of firstMembershipByMember.values()) {
    if (inRange(first.created_at.slice(0, 10), startISO, endISO)) newMembers += 1
  }

  let renewals = 0
  let expiredInPeriod = 0
  const planCounts = new Map()

  for (const m of memberships) {
    const createdDate = m.created_at.slice(0, 10)
    if (m.renewed_from_membership_id && inRange(createdDate, startISO, endISO)) {
      renewals += 1
    }
    if (inRange(m.expiry_date, startISO, endISO)) {
      expiredInPeriod += 1
    }
    if (inRange(createdDate, startISO, endISO)) {
      planCounts.set(m.plan, (planCounts.get(m.plan) || 0) + 1)
    }
  }

  let revenue = 0
  for (const p of payments) {
    if (inRange(p.payment_date, startISO, endISO)) revenue += Number(p.amount)
  }

  const referenceISO = todayISO < endISO ? todayISO : endISO
  const { active: activeMembers, expired: currentlyExpiredAsOfEnd } = activeExpiredAsOf(
    members,
    memberships,
    referenceISO,
    expiringSoonDays
  )

  const totalDue = currentTotalDue(memberships, paidMap)

  return {
    newMembers,
    renewals,
    revenue,
    totalPaymentsRecorded: revenue, // same measure — see section 23/24
    expiredInPeriod,
    activeMembers,
    currentlyExpiredAsOfEnd,
    totalDue,
    planBreakdown: Array.from(planCounts.entries())
      .map(([plan, count]) => ({ plan, count }))
      .sort((a, b) => b.count - a.count),
  }
}

// Month-by-month breakdown table for the yearly view.
export function yearlyMonthBreakdown({ members, memberships, payments, year, expiringSoonDays, todayISO }) {
  const rows = []
  for (let month = 1; month <= 12; month++) {
    const { startISO, endISO } = monthRangeISO(year, month)
    const stats = periodStats({ members, memberships, payments, startISO, endISO, expiringSoonDays, todayISO })
    rows.push({
      month,
      monthLabel: new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short' }),
      newMembers: stats.newMembers,
      renewals: stats.renewals,
      revenue: stats.revenue,
      expired: stats.expiredInPeriod,
    })
  }
  return rows
}

// Global current snapshot of members-per-plan, for the plan
// distribution chart (based on each member's current membership).
export function currentPlanDistribution(members, memberships) {
  const byMember = new Map()
  for (const m of memberships) {
    if (!byMember.has(m.member_id)) byMember.set(m.member_id, [])
    byMember.get(m.member_id).push(m)
  }
  const counts = new Map()
  for (const member of members) {
    const list = byMember.get(member.id) || []
    if (!list.length) continue
    const current = list.reduce((a, b) => (b.start_date > a.start_date ? b : a))
    counts.set(current.plan, (counts.get(current.plan) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([plan, count]) => ({ plan, count }))
    .sort((a, b) => b.count - a.count)
}
