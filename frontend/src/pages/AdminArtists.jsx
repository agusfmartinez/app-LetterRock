import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import RequireEditor from '../components/common/RequireEditor'
import {
  ARTISTS_PAGE_SIZE,
  useAdminArtists,
  useHiddenArtistCount,
  useToggleHidden,
  useUnlinkedArtistCount,
} from '../hooks/useCatalogAdmin'

const SORT_LABELS = {
  'name-asc': 'Nombre A → Z',
  'name-desc': 'Nombre Z → A',
  recent: 'Agregados hace poco',
  oldest: 'Agregados primero',
}

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
          {!hidden && !artist.youtube_linked_at && (
            <span className="text-gray-600" title="Sin esto la timeline no puede destacar un tema"> · sin YouTube</span>
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
  const [sort, setSort] = useState('name-asc')
  const [page, setPage] = useState(0)

  const { data, isLoading, isFetching } = useAdminArtists(search, hidden, page, sort)
  const artists = data?.artists || []
  const total = data?.total || 0
  const { data: hiddenCount = 0 } = useHiddenArtistCount()
  const { data: unlinkedCount = 0 } = useUnlinkedArtistCount()

  const lastPage = Math.max(0, Math.ceil(total / ARTISTS_PAGE_SIZE) - 1)

  // Ocultar los últimos de la última página deja la página fuera de rango y la
  // lista en blanco. Volver atrás sola es menos raro que mostrar el vacío.
  useEffect(() => {
    if (!isFetching && page > lastPage) setPage(lastPage)
  }, [isFetching, page, lastPage])

  // Cualquier cambio de filtro rearma el listado: quedarse en la página 4 de un
  // resultado que ahora tiene una sola página muestra vacío.
  const changeSearch = (value) => {
    setSearch(value)
    setPage(0)
  }
  const changeSort = (value) => {
    setSort(value)
    setPage(0)
  }

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
          {!hidden && unlinkedCount > 0 && (
            <p className="text-gray-600 text-xs mt-1">
              {unlinkedCount} {unlinkedCount === 1 ? 'artista' : 'artistas'} sin vincular a
              YouTube Music: sus discos muestran la playlist entera en vez del tema destacado.
            </p>
          )}
        </div>

        {!hidden && (
          <Link
            to="/admin/descubrir"
            className="inline-block text-sm border border-rock-border rounded px-3 py-1.5 text-gray-400 hover:text-rock-accent hover:border-rock-accent"
          >
            Descubrir bandas
          </Link>
        )}

        <div className="flex gap-2 flex-wrap">
          <input
            value={search}
            onChange={e => changeSearch(e.target.value)}
            placeholder="Buscar artista..."
            className="flex-1 min-w-[12rem] bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
          />
          <select
            value={sort}
            onChange={e => changeSort(e.target.value)}
            className="bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text focus:outline-none focus:border-rock-accent"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

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
          <div className="space-y-3">
            <div className={`bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border ${isFetching ? 'opacity-60' : ''}`}>
              {artists.map(a => <ArtistRow key={a.id} artist={a} hidden={hidden} />)}
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">
                {page * ARTISTS_PAGE_SIZE + 1}–{page * ARTISTS_PAGE_SIZE + artists.length} de {total}
              </span>

              {total > ARTISTS_PAGE_SIZE && (
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 0}
                    className="border border-rock-border rounded px-2 py-1 text-xs text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-rock-border"
                  >
                    ← Anterior
                  </button>
                  <span className="text-gray-500 text-xs">{page + 1} / {lastPage + 1}</span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= lastPage}
                    className="border border-rock-border rounded px-2 py-1 text-xs text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-rock-border"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </div>
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
