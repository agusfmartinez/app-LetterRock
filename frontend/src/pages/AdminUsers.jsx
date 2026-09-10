import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AdminLayout from '../components/common/AdminLayout'
import { EmptyState, SkeletonRows } from '../components/common/States'
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
      <EmptyState
        title="Esta sección es de administradores"
        action={<Link to="/" className="btn btn-secondary">Volver al inicio</Link>}
      >
        Tu cuenta no tiene permiso para gestionar roles.
      </EmptyState>
    )
  }

  return (
    <AdminLayout
      title="Panel"
      lead="Los editores administran el catálogo y las colecciones. Los admins, además, los roles de la gente."
    >
      {error && (
        <p role="alert" className="text-sm text-rock-accentBright bg-rock-accent/10 rounded-md px-3 py-2.5 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <SkeletonRows count={5} />
      ) : (
        <div className="card !p-0 overflow-hidden">
          {users.map(u => {
            const isSelf = u.id === currentUser?.id
            return (
              <div
                key={u.id}
                className="flex items-center gap-3.5 px-5 py-3.5 border-t border-rock-border first:border-t-0"
              >
                <div className="w-10 h-10 flex-none rounded-full bg-rock-accent/20 border border-rock-accentDim
                                grid place-items-center text-rock-accentBright text-sm font-bold">
                  {u.username?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/user/${u.username}`} className="text-[14.5px] font-semibold hover:text-rock-accent">
                    {u.username}
                  </Link>
                  <p className="text-gray-500 text-xs truncate">{u.email}</p>
                </div>
                <select
                  value={u.role || 'user'}
                  disabled={isPending || isSelf}
                  onChange={e => changeRole({ id: u.id, role: e.target.value })}
                  title={isSelf ? 'No podés cambiar tu propio rol' : undefined}
                  aria-label={`Rol de ${u.username}`}
                  className="input !w-auto !min-h-0 !py-1.5 disabled:opacity-50"
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
    </AdminLayout>
  )
}
