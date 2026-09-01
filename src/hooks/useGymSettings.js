import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const DEFAULTS = {
  gym_name: 'CoreEnergy The Gym',
  contact_number: '',
  whatsapp_number: '',
  address: '',
  expiring_soon_days: 7,
}

export function useGymSettings() {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('gym_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data)
        setLoading(false)
      })
  }, [])

  return { settings, loading }
}
