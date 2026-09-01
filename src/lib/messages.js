import { formatDateDisplay } from './dateUtils'
import { formatRupees } from './format'

// Every function returns a plain text string ready to drop into a
// wa.me pre-filled link. All placeholders are filled from real data —
// nothing is sent automatically, the owner still reviews it in WhatsApp
// before pressing send.

export function welcomeMessage({ gymName, member, membership, amountPaid, due }) {
  return (
    `Welcome to ${gymName}! 🎉\n\n` +
    `Dear ${member.full_name},\n\n` +
    `Your gym membership has been successfully activated.\n\n` +
    `Member ID: ${member.member_code}\n` +
    `Membership: ${membership.plan}\n` +
    `Start Date: ${formatDateDisplay(membership.start_date)}\n` +
    `Valid Until: ${formatDateDisplay(membership.expiry_date)}\n` +
    `Amount Paid: ${formatRupees(amountPaid)}\n` +
    `Due Amount: ${formatRupees(due)}\n\n` +
    `Thank you for joining ${gymName}. We look forward to having you with us! 💪`
  )
}

export function paymentConfirmationMessage({ gymName, member, membership, payment, due }) {
  return (
    `Payment Received — ${gymName}\n\n` +
    `Dear ${member.full_name},\n\n` +
    `We've recorded your payment. Thank you!\n\n` +
    `Amount Paid: ${formatRupees(payment.amount)}\n` +
    `Payment Date: ${formatDateDisplay(payment.payment_date)}\n` +
    `Membership: ${membership.plan}\n` +
    `Remaining Due: ${formatRupees(due)}\n\n` +
    `— ${gymName}`
  )
}

export function renewalMessage({ gymName, member, membership, amountPaid, due }) {
  return (
    `Membership Renewed — ${gymName}\n\n` +
    `Dear ${member.full_name},\n\n` +
    `Your membership has been successfully renewed.\n\n` +
    `New Plan: ${membership.plan}\n` +
    `Start Date: ${formatDateDisplay(membership.start_date)}\n` +
    `New Expiry Date: ${formatDateDisplay(membership.expiry_date)}\n` +
    `Amount Paid: ${formatRupees(amountPaid)}\n` +
    `Due Amount: ${formatRupees(due)}\n\n` +
    `Thank you for continuing with ${gymName}! 💪`
  )
}

export function expiryReminderMessage({ gymName, member, membership }) {
  return (
    `Membership Reminder — ${gymName}\n\n` +
    `Dear ${member.full_name},\n\n` +
    `This is a reminder about your membership:\n\n` +
    `Membership: ${membership.plan}\n` +
    `Expiry Date: ${formatDateDisplay(membership.expiry_date)}\n\n` +
    `Please visit us to renew and continue your fitness journey.\n\n` +
    `— ${gymName}`
  )
}

export function membershipDetailsMessage({ gymName, member, membership, totalPaid, due }) {
  return (
    `Membership Details — ${gymName}\n\n` +
    `Dear ${member.full_name},\n\n` +
    `Member ID: ${member.member_code}\n` +
    `Membership: ${membership.plan}\n` +
    `Start Date: ${formatDateDisplay(membership.start_date)}\n` +
    `Expiry Date: ${formatDateDisplay(membership.expiry_date)}\n` +
    `Membership Fee: ${formatRupees(membership.fee)}\n` +
    `Total Paid: ${formatRupees(totalPaid)}\n` +
    `Due Amount: ${formatRupees(due)}\n\n` +
    `— ${gymName}`
  )
}
