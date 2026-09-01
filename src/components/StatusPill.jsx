import { STATUS_LABEL, STATUS_PILL_CLASS } from '../lib/status'

export function MembershipStatusPill({ status }) {
  return <span className={`pill ${STATUS_PILL_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
}

export function PaymentStatusPill({ due }) {
  const paid = Number(due) <= 0
  return (
    <span className={`pill ${paid ? 'pill-active' : 'pill-danger'}`}>
      {paid ? '🟢 PAID' : '🔴 UNPAID/DUE'}
    </span>
  )
}
