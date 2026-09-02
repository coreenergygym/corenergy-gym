import { useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import PhotoPicker from '../components/PhotoPicker'
import MembershipFields, { defaultMembershipValue } from '../components/MembershipFields'
import WhatsAppButtons from '../components/WhatsAppButtons'
import { supabase } from '../lib/supabaseClient'
import { useGymSettings } from '../hooks/useGymSettings'
import { computeDue } from '../lib/status'
import { formatRupees } from '../lib/format'

const EMPTY_PERSONAL = {
  fullName: '',
  mobile: '',

  dateOfBirth: '',
  gender: '',
  address: '',
  emergencyContact: '',
  notes: '',
}

function isValidPhone(raw) {
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

export default function AddMember() {
  const { settings } = useGymSettings()
  const [personal, setPersonal] = useState(EMPTY_PERSONAL)
  const [membershipValue, setMembershipValue] = useState(defaultMembershipValue())
  const [photoBlob, setPhotoBlob] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null) // { member, membership, totalPaid, due, latestPayment }

  function setField(key, val) {
    setPersonal((p) => ({ ...p, [key]: val }))
  }

  function validate() {
    const e = {}
    if (!personal.fullName.trim()) e.fullName = 'Full name is required.'
    if (!personal.mobile.trim()) e.mobile = 'Mobile number is required.'
    else if (!isValidPhone(personal.mobile)) e.mobile = 'Enter a valid mobile number.'
    
    if (!membershipValue.plan.trim()) e.plan = 'Membership plan is required.'
    if (!membershipValue.fee && membershipValue.fee !== 0) e.fee = 'Membership fee is required.'
    if (membershipValue.expiryDate < membershipValue.startDate) e.expiryDate = 'Expiry date cannot be before start date.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')
    if (!validate()) return

    setSubmitting(true)
    try {
      // 1. Get the next member ID from the database (avoids duplicate IDs
      //    if two people add a member at the same moment).
      const { data: memberCode, error: codeError } = await supabase.rpc('generate_member_code')
      if (codeError) throw codeError

      // 2. Create the member record.
      const { data: member, error: memberError } = await supabase
        .from('members')
        .insert({
          member_code: memberCode,
          full_name: personal.fullName.trim(),
          mobile: personal.mobile.trim(),
          
          date_of_birth: personal.dateOfBirth || null,
          gender: personal.gender || null,
          address: personal.address.trim() || null,
          emergency_contact: personal.emergencyContact.trim() || null,
          notes: personal.notes.trim() || null,
        })
        .select()
        .single()
      if (memberError) throw memberError

      // 3. Upload the photo, if one was taken/chosen, to a PRIVATE bucket
      //    path scoped to this member, then save the path (not a public URL).
      let photoPath = null
      if (photoBlob) {
        const path = `${member.id}/${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('member-photos')
          .upload(path, photoBlob, { contentType: 'image/jpeg', upsert: true })
        if (uploadError) throw uploadError
        photoPath = path

        const { error: updateError } = await supabase
          .from('members')
          .update({ photo_path: photoPath })
          .eq('id', member.id)
        if (updateError) throw updateError
        member.photo_path = photoPath
      }

      // 4. Create the membership record.
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .insert({
          member_id: member.id,
          plan: membershipValue.plan.trim(),
          duration_days: membershipValue.durationDays,
          start_date: membershipValue.startDate,
          expiry_date: membershipValue.expiryDate,
          fee: Number(membershipValue.fee),
          notes: membershipValue.notes.trim() || null,
        })
        .select()
        .single()
      if (membershipError) throw membershipError

      // 5. Record the initial payment, only if the owner entered one —
      //    a membership being created never implies money was received.
      let latestPayment = null
      const amountPaid = Number(membershipValue.amountPaid) || 0
      if (amountPaid > 0) {
        const { data: payment, error: paymentError } = await supabase
          .from('payments')
          .insert({
            member_id: member.id,
            membership_id: membership.id,
            amount: amountPaid,
            payment_date: membershipValue.paymentDate,
            purpose: 'Membership',
            method: membershipValue.method || null,
          })
          .select()
          .single()
        if (paymentError) throw paymentError
        latestPayment = payment
      }

      setResult({
        member,
        membership,
        totalPaid: amountPaid,
        due: computeDue(membership.fee, amountPaid),
        latestPayment,
      })
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong while saving. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setPersonal(EMPTY_PERSONAL)
    setMembershipValue(defaultMembershipValue())
    setPhotoBlob(null)
    setResult(null)
    setErrors({})
  }

  if (result) {
    return (
      <AdminLayout title="Add New Member">
        <div className="card" style={{ maxWidth: 560 }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: 6 }}>✅ {result.member.full_name} added</h2>
          <p style={{ marginBottom: 20 }}>
            Member ID <strong>{result.member.member_code}</strong> — {formatRupees(result.totalPaid)} paid,{' '}
            {formatRupees(result.due)} due.
          </p>

          <div className="section-heading" style={{ marginTop: 0, fontSize: '0.95rem' }}>Send a welcome message</div>
          <WhatsAppButtons
            gymName={settings.gym_name}
            member={result.member}
            membership={result.membership}
            totalPaid={result.totalPaid}
            due={result.due}
            latestPayment={result.latestPayment}
            isFreshlyCreated
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to={`/admin/members/${result.member.id}`}>View Full Profile</Link>
            <button className="btn btn-secondary" onClick={resetForm}>Add Another Member</button>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Add New Member">
      <form className="card" style={{ maxWidth: 720 }} onSubmit={handleSubmit}>
        {submitError && <div className="form-error-banner">{submitError}</div>}

        <div className="form-section-title">Personal Details</div>

        <PhotoPicker onPhotoReady={setPhotoBlob} />

        <div className="field-grid">
          <div className="field">
            <label htmlFor="fullName">Full Name</label>
            <input id="fullName" value={personal.fullName} onChange={(e) => setField('fullName', e.target.value)} />
            {errors.fullName && <div className="field-error">{errors.fullName}</div>}
          </div>

          <div className="field">
            <label htmlFor="mobile">Mobile Number</label>
            <input id="mobile" value={personal.mobile} onChange={(e) => setField('mobile', e.target.value)} placeholder="e.g. 9876543210" />
            {errors.mobile && <div className="field-error">{errors.mobile}</div>}
          </div>

        

          <div className="field">
            <label htmlFor="dob">Date of Birth</label>
            <input id="dob" type="date" value={personal.dateOfBirth} onChange={(e) => setField('dateOfBirth', e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="gender">Gender</label>
            <select id="gender" value={personal.gender} onChange={(e) => setField('gender', e.target.value)}>
              <option value="">Select…</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="emergencyContact">Emergency Contact</label>
            <input id="emergencyContact" value={personal.emergencyContact} onChange={(e) => setField('emergencyContact', e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="address">Address</label>
          <textarea id="address" value={personal.address} onChange={(e) => setField('address', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="personalNotes">Notes</label>
          <textarea id="personalNotes" value={personal.notes} onChange={(e) => setField('notes', e.target.value)} />
        </div>

        <div className="form-section-title">Membership Details</div>
        {errors.plan && <div className="field-error" style={{ marginBottom: 10 }}>{errors.plan}</div>}
        {errors.fee && <div className="field-error" style={{ marginBottom: 10 }}>{errors.fee}</div>}
        {errors.expiryDate && <div className="field-error" style={{ marginBottom: 10 }}>{errors.expiryDate}</div>}

        <MembershipFields value={membershipValue} onChange={setMembershipValue} />

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting} style={{ marginTop: 10 }}>
          {submitting ? 'Saving…' : 'Save Member'}
        </button>
      </form>
    </AdminLayout>
  )
}
