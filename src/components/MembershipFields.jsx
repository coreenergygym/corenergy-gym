import { addDays, todayISO } from '../lib/dateUtils'
import { formatDateDisplay } from '../lib/dateUtils'
import { formatRupees } from '../lib/format'
import { computeDue } from '../lib/status'

const DURATION_OPTIONS = [
  { label: '1 Month', days: 30, fee: 1000 },
  { label: '3 Months', days: 90, fee: 3000 },
  { label: '4 Months', days: 120, fee: 3500 },
  { label: '6 Months', days: 180, fee: 5500 },
  { label: '12 Months', days: 365, fee: 9000 },
  { label: 'Custom', days: null, fee: null },
]

const PLAN_SUGGESTIONS = ['General Fitness', 'Strength Training', 'Cardio', 'Personal Training', 'Group Classes']

// `value` shape:
// { plan, durationLabel, durationDays, startDate, expiryDate, fee,
//   amountPaid, paymentDate, method, notes }
export default function MembershipFields({ value, onChange, feeLabel = 'Membership Fee' }) {
  function set(patch) {
    onChange({ ...value, ...patch })
  }

  function handleDurationChange(label) {
  const opt = DURATION_OPTIONS.find((o) => o.label === label)
  const days = opt?.days ?? value.durationDays
  const newExpiry = days ? addDays(value.startDate, days) : value.expiryDate

  set({
    durationLabel: label,
    durationDays: days || value.durationDays,
    expiryDate: newExpiry,
    fee: opt?.fee ?? value.fee,
  })
  }

  function handleCustomDays(days) {
    const n = Number(days) || 0
    set({ durationDays: n, expiryDate: n ? addDays(value.startDate, n) : value.expiryDate })
  }

  function handleStartDateChange(newStart) {
    const days = value.durationDays
    const newExpiry = days ? addDays(newStart, days) : value.expiryDate
    set({ startDate: newStart, expiryDate: newExpiry })
  }

  const due = computeDue(value.fee || 0, value.amountPaid || 0)
  const status = due <= 0 ? 'PAID' : 'UNPAID / DUE'

  return (
    <div>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="plan">Membership Plan</label>
          <input
            id="plan"
            list="plan-suggestions"
            required
            value={value.plan}
            onChange={(e) => set({ plan: e.target.value })}
            placeholder="e.g. General Fitness"
          />
          <datalist id="plan-suggestions">
            {PLAN_SUGGESTIONS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label htmlFor="duration">Duration</label>
          <select id="duration" value={value.durationLabel} onChange={(e) => handleDurationChange(e.target.value)}>
            {DURATION_OPTIONS.map((o) => (
              <option key={o.label} value={o.label}>{o.label}</option>
            ))}
          </select>
        </div>

        {value.durationLabel === 'Custom' && (
          <div className="field">
            <label htmlFor="customDays">Duration (days)</label>
            <input
              id="customDays"
              type="number"
              min="1"
              required
              value={value.durationDays || ''}
              onChange={(e) => handleCustomDays(e.target.value)}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="startDate">Start Date</label>
          <input
            id="startDate"
            type="date"
            required
            value={value.startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="expiryDate">Expiry Date</label>
          <input
            id="expiryDate"
            type="date"
            required
            value={value.expiryDate}
            onChange={(e) => set({ expiryDate: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="fee">{feeLabel} (₹)</label>
          <input
            id="fee"
            type="number"
            min="0"
            step="0.01"
            required
            value={value.fee}
            onChange={(e) => set({ fee: e.target.value })}
          />
        </div>
      </div>

      <div className="form-section-title" style={{ fontSize: '0.95rem', marginTop: 24 }}>Payment (optional — leave as ₹0 if unpaid)</div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="amountPaid">Amount Paid Now (₹)</label>
          <input
            id="amountPaid"
            type="number"
            min="0"
            step="0.01"
            value={value.amountPaid}
            onChange={(e) => set({ amountPaid: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="paymentDate">Payment Date</label>
          <input
            id="paymentDate"
            type="date"
            value={value.paymentDate}
            onChange={(e) => set({ paymentDate: e.target.value })}
            disabled={!Number(value.amountPaid)}
          />
        </div>

        <div className="field">
          <label htmlFor="method">Payment Method</label>
          <select
            id="method"
            value={value.method}
            onChange={(e) => set({ method: e.target.value })}
            disabled={!Number(value.amountPaid)}
          >
            <option value="">Select…</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="membershipNotes">Notes</label>
        <textarea id="membershipNotes" value={value.notes} onChange={(e) => set({ notes: e.target.value })} />
      </div>

      <div className="summary-box">
        <div className="summary-row">
          <span>Start Date</span>
          <span>{formatDateDisplay(value.startDate)}</span>
        </div>
        <div className="summary-row">
          <span>Expiry Date</span>
          <span>{formatDateDisplay(value.expiryDate)}</span>
        </div>
        <div className="summary-row">
          <span>{feeLabel}</span>
          <span>{formatRupees(value.fee || 0)}</span>
        </div>
        <div className="summary-row">
          <span>Amount Paid</span>
          <span>{formatRupees(value.amountPaid || 0)}</span>
        </div>
        <div className="summary-row total">
          <span>Due Amount ({status})</span>
          <span>{formatRupees(due)}</span>
        </div>
      </div>
    </div>
  )
}

export function defaultMembershipValue(startDate = todayISO()) {
  return {
    plan: '',
    durationLabel: '1 Month',
    durationDays: 30,
    startDate,
    expiryDate: addDays(startDate, 30),
    fee: '',
    amountPaid: '',
    paymentDate: todayISO(),
    method: '',
    notes: '',
  }
}
