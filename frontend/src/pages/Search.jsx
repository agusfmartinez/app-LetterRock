import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ArtistCard from '../components/common/ArtistCard'
import FollowButton from '../components/common/FollowButton'
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearchParams({ q: query.trim() }, { replace: true })
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
        searchArtists(query.trim()),
        supabase
          .from('users')
          .select('id, username, avatar_url, bio')
          .ilike('username', `%${query.trim()}%`)
          .limit(10),
      ])
      setResults(artistResult.artists)
      setMessage(artistResult.message || '')
      setUsers((userResult.data || []).filter(u => u.id !== sessionUser?.id))
    } catch {
      setError('Error al buscar. Verificá que el backend esté corriendo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-rock-text mb-6">Buscar</h1>

      <form onSubmit={handleSubmit} className="flex gap-2 max-w-lg mb-8">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Bandas, artistas o usuarios..."
          className="flex-1 bg-rock-dark border border-rock-border rounded-lg px-4 py-3 text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent text-lg"
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="bg-rock-accent text-white px-5 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 flex-shrink-0"
        >
          {loading ? '...' : 'Buscar'}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {message && <p className="text-gray-500 italic">{message}</p>}

      {users.length > 0 && (
        <div className="mb-8 max-w-2xl">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">
            Usuarios
          </h2>
          <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
            {users.map(u => <UserResult key={u.id} user={u} />)}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">
            Bandas y artistas
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            {results.length} resultado{results.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {results.map(a => (
              <ArtistCard key={a.id || a.external_mb_id} artist={a} />
            ))}
          </div>
        </div>
      )}

      {!loading && searched && results.length === 0 && users.length === 0 && !error && !message && (
        <p className="text-gray-500">Sin resultados para &ldquo;{query}&rdquo;</p>
      )}
    </div>
  )
}
