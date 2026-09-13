import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ArtistCard from '../components/common/ArtistCard'
import FollowButton from '../components/common/FollowButton'
import { EmptyState, ErrorState, SkeletonGrid } from '../components/common/States'
import { searchArtists } from '../services/search'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'

/**
 * Un usuario en los resultados.
 *
 * Se busca junto con las bandas y no en otra pantalla porque el que busca
 * "agustin" no sabe de antemano si va a encontrar una banda o una persona, y
 * obligarlo a elegir el buscador correcto antes de buscar es pedirle la
 * respuesta para poder preguntar.
 */
function UserResult({ user }) {
  return (
    <div className="flex items-center gap-3.5 card !py-3">
      <div className="w-10 h-10 flex-none rounded-full overflow-hidden bg-rock-accent/20
                      border border-rock-accentDim grid place-items-center
                      text-rock-accentBright font-bold">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
        ) : (
          user.username[0].toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <Link to={`/user/${user.username}`} className="font-medium hover:text-rock-accent">
          {user.username}
        </Link>
        {user.bio && <p className="text-gray-500 text-[12.5px] truncate">{user.bio}</p>}
      </div>
      <FollowButton userId={user.id} />
    </div>
  )
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState([])
  const [users, setUsers] = useState([])
  const sessionUser = useAuthStore(s => s.user)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const run = async (term) => {
    setSearchParams({ q: term }, { replace: true })
    setLoading(true)
    setError('')
    setMessage('')
    setSearched(true)
    setUsers([])
    try {
      // En paralelo: las bandas las resuelve el backend (que puede caer a
      // MusicBrainz) y los usuarios salen directo de Supabase, donde el SELECT
      // sobre `users` es público.
      const [artistResult, userResult] = await Promise.all([
        searchArtists(term),
        supabase
          .from('users')
          .select('id, username, avatar_url, bio')
          .ilike('username', `%${term}%`)
          .limit(10),
      ])
      setResults(artistResult.artists)
      setMessage(artistResult.message || '')
      setUsers((userResult.data || []).filter(u => u.id !== sessionUser?.id))
    } catch {
      setError('No pudimos completar la búsqueda. Puede ser la conexión con el catálogo.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim()) run(query.trim())
  }

  const nothing = !loading && searched && results.length === 0 && users.length === 0 && !error

  return (
    <div className="animate-fade-up">
      <div className="max-w-[52ch] py-10">
        <h1 className="text-screen mb-4">¿Qué estás buscando?</h1>
        <p className="text-base leading-relaxed text-gray-300 mb-6">
          Bandas, músicos, discos o gente que escucha lo mismo que vos.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2.5 flex-wrap">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Bandas, discos, gente"
            aria-label="Buscar"
            className="input flex-1 min-w-[240px] !min-h-[52px] !text-[17px]"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="btn btn-primary !min-h-[52px] px-7 text-[15px]"
          >
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </form>
      </div>

      {error && <ErrorState title="La búsqueda falló." onRetry={() => run(query.trim())}>{error}</ErrorState>}

      {/* El backend avisa cuando cayó a MusicBrainz o cuando acotó la consulta:
          es contexto sobre el resultado, no un error. */}
      {message && <p className="text-gray-500 text-sm italic mb-6">{message}</p>}

      {loading && <SkeletonGrid count={6} min={140} />}

      {users.length > 0 && (
        <section className="mb-12 max-w-[620px]">
          <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 mb-3.5">
            GENTE · {users.length} {users.length === 1 ? 'RESULTADO' : 'RESULTADOS'}
          </p>
          <div className="flex flex-col gap-2.5">
            {users.map(u => <UserResult key={u.id} user={u} />)}
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section className="mt-12">
          <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 mb-4">
            BANDAS Y ARTISTAS · {results.length} {results.length === 1 ? 'RESULTADO' : 'RESULTADOS'}
          </p>
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>
            {results.map(a => (
              <ArtistCard key={a.id || a.external_mb_id} artist={a} variant="circle" />
            ))}
          </div>
        </section>
      )}

      {nothing && !message && (
        <EmptyState title={`Nada con “${query}”`}>
          Ni en el archivo ni en el catálogo. Probá con menos palabras o con el nombre
          de la banda en vez del disco.
        </EmptyState>
      )}
    </div>
  )
}
