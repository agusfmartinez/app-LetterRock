import { create } from 'zustand'
import { supabase } from '../services/supabaseClient'

interface AuthStore {
  user: any | null
  isLoading: boolean
  setUser: (user: any) => void
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, username: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,

  setUser: (user) => set({ user }),

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
    set({ user: null })
  },
}))
