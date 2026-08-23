import { useAuthStore } from '../store/authStore'

export type Role = 'user' | 'editor' | 'admin'

export const ROLE_LABEL: Record<Role, string> = {
  user: 'Usuario',
  editor: 'Editor',
  admin: 'Admin',
}

/**
 * Rol del usuario logueado. `role` viene de la tabla users, que useAuth y
 * authStore ya traen con `select('*')`.
 * Ojo: esto es sólo para la UI — quien manda de verdad son las policies de RLS.
 */
export function useRole() {
  const { user } = useAuthStore()
  const role = (user?.role ?? null) as Role | null

  return {
    role,
    isEditor: role === 'editor' || role === 'admin',
    isAdmin: role === 'admin',
  }
}
