import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ArtistCard from '../components/common/ArtistCard'
import { searchArtists } from '../services/search'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState([])
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
    try {
      const { artists, message: msg } = await searchArtists(query.trim())
      setResults(artists)
      setMessage(msg || '')
    } catch {
      setError('Error al buscar. Verificá que el backend esté corriendo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-rock-text mb-6">Buscar bandas</h1>

      <form onSubmit={handleSubmit} className="flex gap-2 max-w-lg mb-8">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ej: Soda Stereo, Divididos, Los Redondos..."
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

      {results.length > 0 && (
        <div>
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

      {!loading && searched && results.length === 0 && !error && !message && (
        <p className="text-gray-500">Sin resultados para &ldquo;{query}&rdquo;</p>
      )}
    </div>
  )
}
