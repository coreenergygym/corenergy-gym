import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Tracks whether an admin is currently logged in.
// Every private page uses this to decide what to show.
export function useAuth() {
  const [session, setSession] = useState(undefined) // undefined = "still checking"

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return {
    session,
    isLoading: session === undefined,
    isLoggedIn: !!session,
  }
}
