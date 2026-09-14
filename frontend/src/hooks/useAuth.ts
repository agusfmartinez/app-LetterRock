import { useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { setUser, setSession } = useAuthStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session?.user ? 'present' : 'none')
      if (session?.user) {
        supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            setUser(profile ? { ...session.user, ...profile } : session.user)
          })
      }
    }).catch(() => {
      // Sin esto, un fallo al leer la sesión dejaba la home en blanco para
      // siempre esperando saber si hay alguien.
      setSession('none')
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session?.user ? 'present' : 'none')
      if (session?.user) {
        supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            setUser(profile ? { ...session.user, ...profile } : session.user)
          })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser, setSession])
}
