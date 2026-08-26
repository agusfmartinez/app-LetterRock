import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AlbumCard from '../components/common/AlbumCard'
import FavoriteButton from '../components/common/FavoriteButton'
import MemberList from '../components/common/MemberList'
import MemberTimeline from '../components/common/MemberTimeline'
import ReviewCard from '../components/common/ReviewCard'
import ReviewForm from '../components/forms/ReviewForm'
import { getArtist } from '../services/api'
import { groupByBand, groupByPerson, roleLabel, useBandMembers, useMemberTrajectory } from '../hooks/useArtistMembers'
import { useReviews } from '../hooks/useReviews'

/**
 * Biografía plegada, con transición.
 *
 * Las de Wikipedia van de tres líneas a veinte párrafos —la de Charly García
 * ocupa dos pantallas— y empujaban la discografía tan abajo que había que
 * scrollear a ciegas para llegar a los discos.
 *
 * El botón sólo aparece si el texto realmente desborda: se mide una vez
 * plegado, en vez de adivinar por cantidad de caracteres, porque cuántas líneas
 * entran depende del ancho de la pantalla.
 */
function Bio({ text }) {
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setOverflows(el.scrollHeight > el.clientHeight + 4)
  }, [text])

  const paragraphs = text.split(/\n+/).filter(Boolean)

  return (
    <div className="mt-3 max-w-2xl">
      <div
        ref={ref}
        className={`relative overflow-hidden transition-[max-height] duration-500 ease-in-out ${
          open ? 'max-h-[3000px]' : 'max-h-28'
        }`}
      >
        <div className="space-y-2">
          {paragraphs.map((para, i) => (
            <p key={i} className="text-gray-300 text-sm leading-relaxed">{para}</p>
          ))}
        </div>

        {/* Desvanece el corte para que no parezca texto cortado por un bug. */}
        {!open && overflows && (
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-rock-dark to-transparent pointer-events-none" />
        )}
      </div>

      {overflows && (
        <button
          onClick={() => setOpen(!open)}
          className="text-rock-accent hover:underline text-xs mt-2"
        >
          {open ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  )
}

export default function ArtistDetail() {
  const { slug } = useParams()
  const [albumFilter, setAlbumFilter] = useState('album')

  const { data, isLoading, error } = useQuery({
    queryKey: ['artist', slug],
    queryFn: () => getArtist(slug),
    refetchInterval: (query) => {
      const d = query.state.data
      return d?.ingestingAlbums ? 2000 : false
    },
  })

  const artist = data?.artist
  const albums = data?.albums || []
  const { reviews, createReview, deleteReview } = useReviews('artist', artist?.id)

  // Una banda muestra quiénes pasaron por ella; un solista, por qué bandas pasó.
  // `artist_type` puede venir vacío en las fichas cargadas antes de la
  // migración, así que se piden las dos y se muestra la que traiga algo.
  const { data: members = [] } = useBandMembers(artist?.id)
  const { data: trajectory = [] } = useMemberTrajectory(artist?.external_mb_id)

  // Las etapas se guardan sueltas porque así se editan y así se sabe quién se
  // solapó con quién, pero se leen juntas por músico.
  const people = groupByPerson(members)
  const current = people.filter(p => p.active)
  const former = people.filter(p => !p.active)
  const bandsPlayedIn = groupByBand(trajectory)

  if (isLoading) return <p className="text-gray-500">Cargando...</p>
  if (error) return <p className="text-red-400">Artista no encontrado.</p>
  if (!artist) return null

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-40 h-40 md:w-52 md:h-52 rounded-lg overflow-hidden bg-rock-card flex-shrink-0">
          {artist.image_url ? (
            <img src={artist.image_url} alt={artist.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">🎸</div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-rock-text">{artist.name}</h1>
            <FavoriteButton entityType="artist" entityId={artist.id} />
          </div>
          <p className="text-gray-500 mt-1 text-sm">
            {artist.country && `${artist.country}`}
            {artist.country && artist.formed_year && ' · '}
            {artist.formed_year && `Formado en ${artist.formed_year}`}
          </p>
          {artist.bio && <Bio text={artist.bio} />}
        </div>
      </div>

      {/* Albums */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xl font-bold text-rock-text">Discografía</h2>
          <div className="flex gap-1 bg-rock-card border border-rock-border rounded-lg p-1">
            {[
              { value: 'album', label: 'Álbumes' },
              { value: 'single', label: 'Sencillos y EP' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setAlbumFilter(value)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  albumFilter === value
                    ? 'bg-rock-accent text-black font-semibold'
                    : 'text-gray-400 hover:text-rock-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {data?.ingestingAlbums ? (
          <p className="text-gray-500 text-sm">Cargando discografía...</p>
        ) : (() => {
          const filtered = albums.filter(a => a.album_type === albumFilter)
          return filtered.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin resultados.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map(a => <AlbumCard key={a.id} album={a} />)}
            </div>
          )
        })()}
      </section>

      {people.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-rock-text mb-3">Formación</h2>

          {/*
            En desktop van al lado: el gráfico necesita ancho para que los años
            se separen, y la lista es angosta por naturaleza. Apilados dejaban
            media pantalla vacía a la derecha del gráfico. Abajo de lg vuelven a
            apilarse, que es la única forma de que el gráfico entre.
          */}
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="bg-rock-card border border-rock-border rounded-lg p-4 lg:col-span-3">
              <MemberTimeline people={people} />
            </div>

            <div className="space-y-4 lg:col-span-2">
              {current.length > 0 && former.length > 0 ? (
                <>
                  <div className="bg-rock-card border border-rock-border rounded-lg px-4 py-1">
                    <p className="text-gray-500 text-xs pt-2">Integrantes</p>
                    <MemberList people={current} />
                  </div>
                  <div className="bg-rock-card border border-rock-border rounded-lg px-4 py-1">
                    <p className="text-gray-500 text-xs pt-2">Pasaron por la banda</p>
                    <MemberList people={former} />
                  </div>
                </>
              ) : (
                <div className="bg-rock-card border border-rock-border rounded-lg px-4 py-1">
                  <MemberList people={people} />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {bandsPlayedIn.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-rock-text mb-3">Bandas</h2>
          <div className="max-w-2xl bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
            {bandsPlayedIn.map(band => (
              <div key={band.key} className="flex items-baseline gap-3 p-3 flex-wrap">
                {band.slug ? (
                  <Link
                    to={`/artist/${band.slug}`}
                    className="text-rock-text font-medium hover:text-rock-accent"
                  >
                    {band.name}
                  </Link>
                ) : (
                  <span className="text-rock-text font-medium">{band.name}</span>
                )}
                {band.roles.length > 0 && (
                  <span className="text-gray-500 text-xs">
                    {band.roles.map(roleLabel).join(' · ')}
                  </span>
                )}
                <span className="text-gray-500 text-xs font-mono ml-auto">
                  {band.periods.map(p => `(${p})`).join(' ')}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section>
        <h2 className="text-xl font-bold text-rock-text mb-4">Opiniones</h2>
        <div className="max-w-2xl space-y-4">
          <ReviewForm entityType="artist" entityId={artist.id} onSubmit={createReview} />
          {reviews.map(r => (
            <ReviewCard
              key={r.id}
              review={r}
              onDelete={() => deleteReview(r.id)}
            />
          ))}
          {reviews.length === 0 && (
            <p className="text-gray-500 text-sm">Sin opiniones aún. ¡Sé el primero!</p>
          )}
        </div>
      </section>
    </div>
  )
}
