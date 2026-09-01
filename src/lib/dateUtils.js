// All dates in this app are plain "YYYY-MM-DD" strings (date-only,
// no time/timezone confusion) — that's what <input type="date"> and
// Postgres "date" columns both use natively.

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + Number(days))
  return d.toISOString().slice(0, 10)
}

export function formatDateDisplay(isoDate) {
  if (!isoDate) return '—'
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Positive = days remaining, negative = days since expiry
export function daysUntil(isoDate) {
  const today = new Date(todayISO() + 'T00:00:00')
  const target = new Date(isoDate + 'T00:00:00')
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}
