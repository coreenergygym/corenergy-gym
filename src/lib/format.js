export function formatRupees(amount) {
  const n = Number(amount) || 0
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}
