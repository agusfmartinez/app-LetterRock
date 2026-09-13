import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import RequireEditor from '../components/common/RequireEditor'
import AdminLayout from '../components/common/AdminLayout'
import { EmptyState, SkeletonRows } from '../components/common/States'
import { IconArrowLeft } from '../components/common/Icons'
import ArrowLink from '../components/common/ArrowLink'
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
    <div className="flex items-center gap-3.5 px-5 py-3.5 flex-wrap border-t border-rock-border first:border-t-0">
      <div className={`w-11 h-11 flex-none rounded-full overflow-hidden bg-rock-border grid place-items-center ${hidden ? 'opacity-40' : ''}`}>
        {artist.image_url ? (
          <img src={artist.image_url} alt="" className="w-full h-full object-cover washed" />
        ) : (
          <span className="font-display text-sm text-gray-500">{artist.name?.[0]?.toUpperCase()}</span>
        )}
      </div>

      <div className="flex-1 min-w-[180px]">
        <Link
          to={`/admin/artista/${artist.id}`}
          className={`text-[14.5px] font-semibold hover:text-rock-accent ${hidden ? 'text-gray-500' : ''}`}
        >
          {artist.name}
        </Link>
        <p className="text-gray-500 text-xs mt-0.5">
          {[artist.country, artist.formed_year].filter(Boolean).join(' · ') || 'sin datos'}
          {artist.manual_fields?.length > 0 && (
            <span className="text-rock-accent"> · {artist.manual_fields.length} campo(s) editado(s)</span>
          )}
          {!hidden && !artist.youtube_linked_at && (
            <span className="text-gray-500" title="Sin esto la timeline no puede destacar un tema"> · sin YouTube</span>
          )}
        </p>
      </div>

      {hidden ? (
        <button
          onClick={() => toggle.mutate({ id: artist.id, hidden: false })}
          disabled={toggle.isPending}
          className="btn !min-h-0 !px-3.5 !py-1.5 !text-[12.5px] border-rock-accent text-rock-accent"
        >
          Restaurar
        </button>
      ) : (
        <>
          <Link
            to={`/admin/artista/${artist.id}`}
            className="btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px]"
          >
            Editar
          </Link>
          <ArrowLink to={`/artist/${artist.slug}`} target="_blank" rel="noopener noreferrer">
            Ver
          </ArrowLink>
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
      <AdminLayout
        title="Panel"
        lead={hidden
          ? 'Los artistas ocultos no aparecen en búsquedas ni en la home, tampoco entre los resultados de MusicBrainz. Restaurarlos los devuelve al catálogo.'
          : 'Corregir datos de artistas, discos y canciones. Lo que edites acá queda protegido de la próxima ingesta de Spotify.'}
      >
        {hidden && (
          <Link
            to="/admin/catalogo"
            className="inline-flex items-center gap-2 text-[13.5px] text-gray-400 hover:text-rock-accent mb-5"
          >
            <IconArrowLeft size={14} /> Catálogo
          </Link>
        )}

        {!hidden && unlinkedCount > 0 && (
          <p className="text-gray-500 text-xs mb-4">
            {unlinkedCount} {unlinkedCount === 1 ? 'artista' : 'artistas'} sin vincular a
            YouTube Music: sus discos muestran la playlist entera en vez del tema destacado.
          </p>
        )}

        <div className="flex gap-2.5 flex-wrap items-center mb-5">
          <input
            value={search}
            onChange={e => changeSearch(e.target.value)}
            placeholder="Buscar artista"
            aria-label="Buscar artista"
            className="input flex-1 min-w-[200px] !min-h-[44px]"
          />
          <select
            value={sort}
            onChange={e => changeSort(e.target.value)}
            aria-label="Ordenar"
            className="input !w-auto flex-none !min-h-[44px]"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {!hidden && (
            <Link to="/admin/descubrir" className="btn btn-secondary">Descubrir bandas</Link>
          )}
        </div>

        {isLoading ? (
          <SkeletonRows count={5} />
        ) : artists.length === 0 ? (
          <EmptyState title={search ? 'Sin resultados' : hidden ? 'No hay artistas ocultos' : 'El catálogo está vacío'}>
            {search
              ? 'Probá con parte del nombre.'
              : hidden
                ? 'Nada fue bajado del catálogo.'
                : 'Traé la primera banda desde Descubrir.'}
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <div className={`card !p-0 overflow-hidden ${isFetching ? 'opacity-60' : ''}`}>
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
                    aria-label="Página anterior"
                    className="btn btn-secondary btn-icon"
                  >
                    ←
                  </button>
                  <span className="text-gray-500 text-xs">{page + 1} / {lastPage + 1}</span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= lastPage}
                    aria-label="Página siguiente"
                    className="btn btn-secondary btn-icon"
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {!hidden && hiddenCount > 0 && (
          <ArrowLink to="/admin/catalogo/ocultos" className="mt-5">Ver ocultos ({hiddenCount})</ArrowLink>
        )}
      </AdminLayout>
    </RequireEditor>
  )
}
