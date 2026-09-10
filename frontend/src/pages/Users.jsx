import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import FollowButton from '../components/common/FollowButton'
import { EmptyState, ErrorState, SkeletonRows } from '../components/common/States'
import { IconSearch } from '../components/common/Icons'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'

function UserRow({ user }) {
  return (
    <div className="flex items-center gap-3.5 card !py-3">
      <div className="w-11 h-11 flex-none rounded-full overflow-hidden bg-rock-accent/20
                      border border-rock-accentDim grid place-items-center
                      text-rock-accentBright font-bold">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
        ) : (
          user.username[0].toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <Link to={`/user/${user.username}`} className="font-semibold text-[14.5px] hover:text-rock-accent">
          {user.username}
        </Link>
        {user.bio && <p className="text-gray-500 text-[12.5px] truncate">{user.bio}</p>}
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

  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['users-directory', query],
    queryFn: async () => {
      let request = supabase
        .from('users')
        .select('id, username, avatar_url, bio, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (query) request = request.ilike('username', `%${query}%`)

      const { data, error: dbError } = await request
      if (dbError) throw dbError
      return data || []
    },
  })

  // El propio perfil no se lista: no hay nada que hacer con él acá.
  const visible = users.filter(u => u.id !== sessionUser?.id)

  return (
    <div className="animate-fade-up">
      <div className="max-w-[52ch] py-10">
        <h1 className="text-screen mb-3.5">Gente</h1>
        <p className="text-base leading-relaxed text-gray-300 mb-6">
          Buscá a alguien por su nombre y seguilo para que su actividad te aparezca
          en el feed.
        </p>
        <div className="relative flex items-center max-w-[360px]">
          <IconSearch size={15} className="absolute left-4 text-gray-500 pointer-events-none" />
          <input
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="Buscar usuario"
            aria-label="Buscar usuario"
            className="input pl-10 !min-h-[46px]"
          />
        </div>
      </div>

      <p className="font-mono text-[10px] tracking-[0.16em] text-gray-500 mb-3.5">
        {query ? 'RESULTADOS' : 'ÚLTIMOS EN SUMARSE'}
      </p>

      <div className="max-w-[620px]">
        {isLoading ? (
          <SkeletonRows count={5} />
        ) : error ? (
          <ErrorState title="No pudimos traer la lista de usuarios." onRetry={refetch} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={query ? 'Nadie con ese nombre' : 'Todavía no hay más gente'}
            action={!query && !sessionUser && (
              <Link to="/auth/signup" className="btn btn-secondary">Crear una cuenta</Link>
            )}
          >
            {query
              ? 'Probá con parte del nombre: la búsqueda es por coincidencia.'
              : 'La comunidad es chica y recién empieza.'}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-2.5">
            {visible.map(u => <UserRow key={u.id} user={u} />)}
          </div>
        )}
      </div>
    </div>
  )
}
