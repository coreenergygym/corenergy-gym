// Normalizes a saved mobile number into the digits-only format WhatsApp
// links need (country code + number, no +, spaces or dashes).
// Assumes India (91) when a 10-digit local number is stored, since the
// gym's example data/currency is INR — safe default for numbers that
// already include a country code (11+ digits) which are left as-is.
export function normalizePhoneForWhatsApp(rawNumber) {
  const digits = (rawNumber || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10) return `91${digits}`
  return digits
}

export function buildWhatsAppLink(rawNumber, message) {
  const phone = normalizePhoneForWhatsApp(rawNumber)
  if (!phone) return null
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
