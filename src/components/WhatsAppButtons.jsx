import { buildWhatsAppLink } from '../lib/whatsapp'
import {
  welcomeMessage,
  paymentConfirmationMessage,
  renewalMessage,
  expiryReminderMessage,
  membershipDetailsMessage,
} from '../lib/messages'

// Each button builds its own message and its own wa.me link — nothing
// is combined into one generic button, per the spec. If the member has
// no saved mobile number, the buttons disable themselves rather than
// producing a broken link.
export default function WhatsAppButtons({ gymName, member, membership, totalPaid, due, latestPayment, isFreshlyCreated }) {
  const hasPhone = !!member.mobile

  function open(message) {
    const link = buildWhatsAppLink(member.mobile, message)
    if (link) window.open(link, '_blank', 'noopener')
  }

  return (
    <div className="whatsapp-btn-row">
      {isFreshlyCreated && (
        <button
          className="btn btn-whatsapp"
          disabled={!hasPhone}
          onClick={() => open(welcomeMessage({ gymName, member, membership, amountPaid: totalPaid, due }))}
        >
          🟢 Welcome Message
        </button>
      )}

      <button
        className="btn btn-whatsapp"
        disabled={!hasPhone || !latestPayment}
        onClick={() =>
          latestPayment &&
          open(paymentConfirmationMessage({ gymName, member, membership, payment: latestPayment, due }))
        }
      >
        💰 Payment Confirmation
      </button>

      <button
        className="btn btn-whatsapp"
        disabled={!hasPhone}
        onClick={() => open(renewalMessage({ gymName, member, membership, amountPaid: totalPaid, due }))}
      >
        🔄 Renewal Message
      </button>

      <button
        className="btn btn-whatsapp"
        disabled={!hasPhone}
        onClick={() => open(expiryReminderMessage({ gymName, member, membership }))}
      >
        ⏰ Expiry Reminder
      </button>

      <button
        className="btn btn-whatsapp"
        disabled={!hasPhone}
        onClick={() => open(membershipDetailsMessage({ gymName, member, membership, totalPaid, due }))}
      >
        📋 Membership Details
      </button>
    </div>
  )
}
