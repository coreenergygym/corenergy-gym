// Single source of truth for "what does this membership's status mean".
// Used by the Dashboard, Members list, and Member Profile so the three
// screens can never disagree with each other.

// referenceDateISO defaults to today, but callers computing a
// historical snapshot (e.g. past-year statistics) can pass an
// explicit "as of" date instead so the status reflects that point
// in time rather than right now.
export function computeMembershipStatus(expiryDateISO, expiringSoonDays, referenceDateISO) {
  const today = referenceDateISO ? new Date(referenceDateISO + 'T00:00:00') : new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDateISO + 'T00:00:00')

  if (expiry < today) return 'expired'

  const soonCutoff = new Date(today)
  soonCutoff.setDate(soonCutoff.getDate() + Number(expiringSoonDays ?? 7))

  if (expiry <= soonCutoff) return 'expiring'
  return 'active'
}

export const STATUS_LABEL = {
  active: 'Active',
  expiring: 'Expiring Soon',
  expired: 'Expired',
}

export const STATUS_PILL_CLASS = {
  active: 'pill-active',
  expiring: 'pill-warning',
  expired: 'pill-danger',
}

// Due Amount = Membership Fee - Payments Recorded Against That Membership.
// Never negative — an overpayment just shows Due as ₹0.
export function computeDue(fee, totalPaid) {
  return Math.max(0, Number(fee) - Number(totalPaid))
}

export function computePaymentStatus(fee, totalPaid) {
  return computeDue(fee, totalPaid) <= 0 ? 'PAID' : 'UNPAID/DUE'
}
