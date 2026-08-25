import { useState } from 'react'
import { Link } from 'react-router-dom'
import RequireEditor from '../components/common/RequireEditor'
import {
  useAdminArtists,
  useHiddenArtistCount,
  useToggleHidden,
} from '../hooks/useCatalogAdmin'

function ArtistRow({ artist, hidden }) {
  const toggle = useToggleHidden('artists')

  return (
    <div className="flex items-center gap-3 p-3">
      <div className={`w-10 h-10 rounded-full overflow-hidden bg-rock-dark flex-shrink-0 ${hidden ? 'opacity-40' : ''}`}>
        {artist.image_url ? (
          <img src={artist.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm">🎸</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <Link
          to={`/admin/artista/${artist.id}`}
          className={`font-medium hover:text-rock-accent ${hidden ? 'text-gray-500' : 'text-rock-text'}`}
        >
          {artist.name}
        </Link>
        <p className="text-gray-500 text-xs">
          {[artist.country, artist.formed_year].filter(Boolean).join(' · ') || 'sin datos'}
          {artist.manual_fields?.length > 0 && (
            <span className="text-rock-accent"> · {artist.manual_fields.length} campo(s) editado(s)</span>
          )}
        </p>
      </div>

      {hidden ? (
        <button
          onClick={() => toggle.mutate({ id: artist.id, hidden: false })}
          disabled={toggle.isPending}
          className="text-xs border border-rock-accent rounded px-2 py-1 text-rock-accent disabled:opacity-50"
        >
          Restaurar
        </button>
      ) : (
        <>
          <Link
            to={`/admin/artista/${artist.id}`}
            className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent"
          >
            Editar
          </Link>
          <Link
            to={`/artist/${artist.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-rock-accent text-sm"
          >
            Ver →
          </Link>
        </>
      )}
    </div>
  )
}

/** Sirve al catálogo y a la pantalla de ocultos: cambia sólo el filtro. */
export default function AdminArtists({ hidden = false }) {
  const [search, setSearch] = useState('')
  const { data: artists = [], isLoading } = useAdminArtists(search, hidden)
  const { data: hiddenCount = 0 } = useHiddenArtistCount()

  return (
    <RequireEditor>
      <div className="space-y-6 max-w-3xl">
        <div>
          {hidden && (
            <Link to="/admin/catalogo" className="text-gray-400 hover:text-rock-accent text-sm">
              ← Catálogo
            </Link>
          )}
          <h1 className="text-2xl font-bold text-rock-text mt-2">
            {hidden ? 'Artistas ocultos' : 'Catálogo'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {hidden
              ? 'No aparecen en búsquedas ni en la home, tampoco entre los resultados de MusicBrainz. Restaurarlos los devuelve al catálogo.'
              : 'Corregir datos de artistas, discos y canciones. Lo que edites acá queda protegido de la próxima ingesta de Spotify.'}
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
            {search
              ? 'Sin resultados.'
              : hidden
                ? 'No hay artistas ocultos.'
                : 'Todavía no hay artistas en la base.'}
          </p>
        ) : (
          <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
            {artists.map(a => <ArtistRow key={a.id} artist={a} hidden={hidden} />)}
          </div>
        )}

        {!hidden && hiddenCount > 0 && (
          <Link
            to="/admin/catalogo/ocultos"
            className="inline-block text-sm text-gray-500 hover:text-rock-accent"
          >
            Ver ocultos ({hiddenCount}) →
          </Link>
        )}
      </div>
    </RequireEditor>
  )
}
