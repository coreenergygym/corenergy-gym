import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const FALLBACK = {
  gym_name: 'CoreEnergy The Gym',
  contact_number: '',
  whatsapp_number: '',
  address: '',
}

export default function PublicSite() {
  const [settings, setSettings] = useState(FALLBACK)

  useEffect(() => {
    // gym_settings is protected by RLS for writes, but public visitors
    // still can't read it directly — that's fine, this content is meant
    // to be edited once and can also just be hardcoded if you prefer.
    // We attempt a read; if it's blocked, the fallback text above is used.
    supabase
      .from('gym_settings')
      .select('gym_name, contact_number, whatsapp_number, address')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data)
      })
  }, [])

  const waLink = settings.whatsapp_number
    ? `https://wa.me/${settings.whatsapp_number.replace(/\D/g, '')}`
    : null

  return (
    <div>
      <section className="public-hero">
        <div className="container">
          <h1>Train hard. Track everything.</h1>
          <p className="lede">
            {settings.gym_name} keeps every member, membership and payment on
            record — so nothing gets lost between the front desk and the
            floor.
          </p>
          <div className="hero-actions">
            {waLink && (
              <a className="btn btn-whatsapp" href={waLink} target="_blank" rel="noreferrer">
                Message us on WhatsApp
              </a>
            )}
            <Link className="btn btn-secondary" to="/admin/login" style={{ background: '#fff' }}>
              🔐 Admin Login
            </Link>
          </div>
        </div>
      </section>

      <section className="info-strip">
        <div className="container">
          <div className="info-grid">
            <div>
              <h3>Contact</h3>
              <p>{settings.contact_number || 'Add your number in Settings'}</p>
            </div>
            <div>
              <h3>WhatsApp</h3>
              <p>{settings.whatsapp_number || 'Add your WhatsApp number in Settings'}</p>
            </div>
            <div>
              <h3>Location</h3>
              <p>{settings.address || 'Add your address in Settings'}</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="public-footer">
        <div className="container">
          © {new Date().getFullYear()} {settings.gym_name}
        </div>
      </footer>
    </div>
  )
}
