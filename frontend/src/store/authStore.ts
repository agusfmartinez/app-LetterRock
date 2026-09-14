import { create } from 'zustand'
import { supabase } from '../services/supabaseClient'

/**
 * Si hay sesión, antes de que llegue el perfil. `user` recién se completa
 * después de pedir la fila de `users`, y mientras tanto es `null` igual que sin
 * sesión: quien necesite distinguir "todavía no sé" de "no hay nadie" (la home,
 * que cambia de forma) mira esto.
 */
export type SessionState = 'unknown' | 'none' | 'present'

interface AuthStore {
  user: any | null
  session: SessionState
  isLoading: boolean
  setUser: (user: any) => void
  setSession: (session: SessionState) => void
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, username: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: 'unknown',
  isLoading: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),

  login: async (email, password) => {
    set({ isLoading: true })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      set({ isLoading: false })
      throw error
    }
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()
    set({ user: { ...data.user, ...profile }, isLoading: false })
  },

  signup: async (email, password, username) => {
    set({ isLoading: true })
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      set({ isLoading: false })
      throw error
    }
    if (data.user) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({ id: data.user.id, email, username })
      if (insertError) {
        set({ isLoading: false })
        throw new Error('No se pudo crear el perfil: ' + insertError.message)
      }
    }
    set({
      user: data.user ? { ...data.user, username } : null,
      isLoading: false,
    })
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: 'none' })
  },
}))
