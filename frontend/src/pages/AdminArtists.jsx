import { useState } from 'react'
import { Link } from 'react-router-dom'
import RequireEditor from '../components/common/RequireEditor'
import { useAdminArtists } from '../hooks/useCatalogAdmin'

export default function AdminArtists() {
  const [search, setSearch] = useState('')
  const { data: artists = [], isLoading } = useAdminArtists(search)

  return (
    <RequireEditor>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-rock-text">Catálogo</h1>
          <p className="text-gray-500 text-sm mt-1">
            Corregir datos de artistas, discos y canciones. Lo que edites acá queda
            protegido de la próxima ingesta de Spotify.
          </p>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar artista..."
          className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
        />

        {isLoading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : artists.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {search ? 'Sin resultados.' : 'Todavía no hay artistas en la base.'}
          </p>
        ) : (
          <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
            {artists.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-rock-dark flex-shrink-0">
                  {a.image_url ? (
                    <img src={a.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm">🎸</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <Link
                    to={`/admin/artista/${a.id}`}
                    className={`font-medium hover:text-rock-accent ${
                      a.hidden ? 'text-gray-600 line-through' : 'text-rock-text'
                    }`}
                  >
                    {a.name}
                  </Link>
                  <p className="text-gray-500 text-xs">
                    {[a.country, a.formed_year].filter(Boolean).join(' · ') || 'sin datos'}
                    {a.manual_fields?.length > 0 && (
                      <span className="text-rock-accent"> · {a.manual_fields.length} campo(s) editado(s)</span>
                    )}
                  </p>
                </div>

                <Link
                  to={`/admin/artista/${a.id}`}
                  className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent"
                >
                  Editar
                </Link>
                <Link
                  to={`/artist/${a.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-rock-accent text-sm"
                >
                  Ver →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </RequireEditor>
  )
}
