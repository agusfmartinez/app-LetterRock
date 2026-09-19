import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useConfirm } from '../components/common/ConfirmDialog'
import RequireEditor from '../components/common/RequireEditor'
import AdminLayout from '../components/common/AdminLayout'
import { EmptyState, SkeletonRows } from '../components/common/States'
import ArrowLink from '../components/common/ArrowLink'
import RowMenu from '../components/common/RowMenu'
import { IconArrowLeft, IconArrowRight, IconSearch } from '../components/common/Icons'
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

const TAG = 'tag !text-[10.5px] !py-0.5'

function ArtistRow({ artist, hidden }) {
  const toggle = useToggleHidden('artists')
  const confirm = useConfirm()

  const hide = async () => {
    const ok = await confirm({
      title: 'Ocultar artista',
      message: `"${artist.name}" deja de aparecer en búsquedas, en la home y entre los resultados de MusicBrainz. Se puede restaurar desde Ocultos.`,
      confirmLabel: 'Ocultar',
    })
    if (ok) toggle.mutate({ id: artist.id, hidden: true })
  }

  const meta = [artist.country, artist.formed_year].filter(Boolean).join(' · ') || 'Sin datos'
  const edited = artist.manual_fields?.length || 0

  return (
    <div className="flex items-center gap-4 px-4 sm:px-5 py-3.5 border-t border-rock-border first:border-t-0">
      <div className={`w-11 h-11 flex-none rounded-full overflow-hidden bg-rock-border grid place-items-center ${hidden ? 'opacity-50' : ''}`}>
        {artist.image_url ? (
          <img src={artist.image_url} alt="" className="w-full h-full object-cover washed" />
        ) : (
          <span className="font-display text-sm text-gray-500">{artist.name?.[0]?.toUpperCase()}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/admin/artista/${artist.id}`}
            className={`text-[15px] font-semibold hover:text-rock-accent ${hidden ? 'text-gray-500' : ''}`}
          >
            {artist.name}
          </Link>
          {/* Estados como etiquetas: se leen de un vistazo recorriendo la lista. */}
          {edited > 0 && (
            <span
              className={`${TAG} tag-accent`}
              title="Campos corregidos a mano: la próxima ingesta de Spotify no los pisa"
            >
              {edited === 1 ? '1 campo editado' : `${edited} campos editados`}
            </span>
          )}
          {!hidden && !artist.youtube_linked_at && (
            <span
              className={`${TAG} tag-neutral`}
              title="Sin esto la timeline no puede destacar un tema"
            >
              Sin YouTube
            </span>
          )}
        </div>
        <p className="text-gray-500 text-[12.5px] mt-0.5 truncate">{meta}</p>
      </div>

      {hidden ? (
        // En Ocultos, restaurar es lo único que se viene a hacer: va a la vista.
        <button
          onClick={() => toggle.mutate({ id: artist.id, hidden: false })}
          disabled={toggle.isPending}
          className="btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px]"
        >
          Restaurar
        </button>
      ) : (
        <>
          <Link
            to={`/admin/artista/${artist.id}`}
            className="btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px] hidden sm:inline-flex"
          >
            Editar
          </Link>
          <ArrowLink to={`/artist/${artist.slug}`} target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex">
            Ver
          </ArrowLink>
          <RowMenu
            disabled={toggle.isPending}
            items={[
              {
                label: 'Ocultar',
                hint: 'Lo baja del sitio sin borrarlo.',
                onClick: hide,
                danger: true,
              },
            ]}
          />
        </>
      )}
    </div>
  )
}

/** Sirve al catálogo y a la pantalla de ocultos: cambia sólo el filtro. */
export default function AdminArtists({ hidden = false }) {
  const navigate = useNavigate()
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

  // Cambiar de pestaña arranca de la primera página.
  useEffect(() => { setPage(0) }, [hidden])

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
          ? 'Los ocultos no aparecen en búsquedas, en la home ni entre los resultados de MusicBrainz.'
          : 'Corregí datos de artistas, discos y canciones. Lo que edites queda protegido de la próxima ingesta de Spotify.'}
      >
        {/*
          Activos y Ocultos son dos direcciones (`/admin/catalogo` y
          `/admin/catalogo/ocultos`) pero se ven como pestañas de la misma
          lista: antes Ocultos era un link al pie y, adentro, un "volver".
        */}
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <div className="seg">
            {[
              { value: false, label: 'Activos', to: '/admin/catalogo' },
              { value: true, label: `Ocultos${hiddenCount ? ` (${hiddenCount})` : ''}`, to: '/admin/catalogo/ocultos' },
            ].map(t => (
              <label key={t.label} className="seg-opt">
                <input
                  type="radio"
                  name="catalogo-vista"
                  checked={hidden === t.value}
                  onChange={() => navigate(t.to)}
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>

          <div className="relative flex items-center flex-1 min-w-[200px]">
            <IconSearch size={15} className="absolute left-4 text-gray-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => changeSearch(e.target.value)}
              placeholder="Buscar artista"
              aria-label="Buscar artista"
              className="input pl-10"
            />
          </div>

          <select
            value={sort}
            onChange={e => changeSort(e.target.value)}
            aria-label="Ordenar"
            className="input !w-auto flex-none"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {!hidden && unlinkedCount > 0 && (
          <p className="text-[12.5px] text-gray-400 rounded-[14px] bg-rock-card px-4 py-2.5 mb-4">
            <span className="text-rock-text font-medium">{unlinkedCount}</span>{' '}
            {unlinkedCount === 1 ? 'artista' : 'artistas'} sin vincular a YouTube Music: sus discos
            muestran la playlist entera en vez del tema destacado. Se vinculan desde la ficha de cada uno.
          </p>
        )}

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
            {/* Sin overflow-hidden: el menú "⋯" de la última fila sale por abajo. */}
            <div className={`card !p-0 ${isFetching ? 'opacity-60' : ''}`}>
              {artists.map(a => <ArtistRow key={a.id} artist={a} hidden={hidden} />)}
            </div>

            <div className="flex items-center gap-3 text-[13px]">
              <span className="text-gray-500">
                {page * ARTISTS_PAGE_SIZE + 1}–{page * ARTISTS_PAGE_SIZE + artists.length} de {total}
              </span>

              {total > ARTISTS_PAGE_SIZE && (
                <div className="ml-auto flex items-center gap-2.5">
                  <button
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 0}
                    aria-label="Página anterior"
                    className="btn btn-secondary btn-icon"
                  >
                    <IconArrowLeft size={16} />
                  </button>
                  <span className="text-gray-500 text-xs tabular-nums">{page + 1} / {lastPage + 1}</span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= lastPage}
                    aria-label="Página siguiente"
                    className="btn btn-secondary btn-icon"
                  >
                    <IconArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </AdminLayout>
    </RequireEditor>
  )
}
