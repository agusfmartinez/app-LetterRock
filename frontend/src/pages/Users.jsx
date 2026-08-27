import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import FollowButton from '../components/common/FollowButton'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'

function UserRow({ user }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-rock-accent flex items-center justify-center text-white font-bold flex-shrink-0">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
        ) : (
          user.username[0].toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <Link to={`/user/${user.username}`} className="text-rock-text font-medium hover:text-rock-accent">
          {user.username}
        </Link>
        {user.bio && <p className="text-gray-500 text-xs truncate">{user.bio}</p>}
      </div>
      <FollowButton userId={user.id} />
    </div>
  )
}

/**
 * Buscador y directorio de usuarios.
 *
 * Hasta acá, la única forma de llegar al perfil de alguien era que justo
 * hubiera hecho algo reciente y apareciera en el feed. Seguir a una persona no
 * puede depender de eso.
 *
 * Sin texto muestra los últimos en sumarse, que con una comunidad chica es la
 * lista completa y sirve de directorio.
 */
export default function Users() {
  const [term, setTerm] = useState('')
  const sessionUser = useAuthStore(s => s.user)
  const query = term.trim()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-directory', query],
    queryFn: async () => {
      let request = supabase
        .from('users')
        .select('id, username, avatar_url, bio, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (query) request = request.ilike('username', `%${query}%`)

      const { data } = await request
      return data || []
    },
  })

  // El propio perfil no se lista: no hay nada que hacer con él acá.
  const visible = users.filter(u => u.id !== sessionUser?.id)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-rock-text">Usuarios</h1>
        <p className="text-gray-500 text-sm mt-1">
          Buscá a alguien por su nombre y seguilo para ver su actividad en tu inicio.
        </p>
      </div>

      <input
        value={term}
        onChange={e => setTerm(e.target.value)}
        placeholder="Buscar usuario..."
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />

      {isLoading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : visible.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {query ? 'Ningún usuario con ese nombre.' : 'Todavía no hay otros usuarios.'}
        </p>
      ) : (
        <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
          {visible.map(u => <UserRow key={u.id} user={u} />)}
        </div>
      )}
    </div>
  )
}
