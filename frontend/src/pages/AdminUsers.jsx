import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ROLE_LABEL, useRole } from '../hooks/useRole'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'

const ROLES = ['user', 'editor', 'admin']

export default function AdminUsers() {
  const { isAdmin } = useRole()
  const { user: currentUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('id, username, email, role, created_at')
        .order('created_at', { ascending: true })
      return data || []
    },
    enabled: isAdmin,
  })

  const { mutate: changeRole, isPending } = useMutation({
    mutationFn: async ({ id, role }) => {
      const { error } = await supabase.from('users').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setError('')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (e) => setError(e.message || 'No se pudo cambiar el rol.'),
  })

  if (!isAdmin) {
    return (
      <div className="max-w-2xl">
        <p className="text-red-400">No tenés permisos para ver esta página.</p>
        <Link to="/" className="text-rock-accent hover:underline text-sm mt-2 block">
          Volver al inicio →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-rock-text">Gestión de usuarios</h1>
        <p className="text-gray-500 text-sm mt-1">
          Los editores pueden administrar contenido editorial. Los admins, además, gestionan usuarios.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {isLoading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
          {users.map(u => {
            const isSelf = u.id === currentUser?.id
            return (
              <div key={u.id} className="flex items-center gap-3 p-3">
                <div className="w-8 h-8 rounded-full bg-rock-accent flex-shrink-0 flex items-center justify-center text-white text-sm font-bold">
                  {u.username?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/user/${u.username}`} className="text-rock-text hover:text-rock-accent">
                    {u.username}
                  </Link>
                  <p className="text-gray-500 text-xs truncate">{u.email}</p>
                </div>
                <select
                  value={u.role || 'user'}
                  disabled={isPending || isSelf}
                  onChange={e => changeRole({ id: u.id, role: e.target.value })}
                  title={isSelf ? 'No podés cambiar tu propio rol' : undefined}
                  className="bg-rock-dark border border-rock-border rounded px-2 py-1 text-sm text-rock-text disabled:opacity-50"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
