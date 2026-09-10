import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AlbumCard from '../components/common/AlbumCard'
import FavoriteButton from '../components/common/FavoriteButton'
import MemberList from '../components/common/MemberList'
import MemberTimeline from '../components/common/MemberTimeline'
import ReviewCard from '../components/common/ReviewCard'
import ReviewForm from '../components/forms/ReviewForm'
import {
  EmptyState,
  ErrorState,
  NotFoundLine,
  SkeletonFicha,
  SkeletonGrid,
} from '../components/common/States'
import { getArtist } from '../services/api'
import { originLabel } from '../services/artists'
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
    <div className="mt-1">
      <div
        ref={ref}
        className={`relative overflow-hidden transition-[max-height] duration-500 ease-in-out ${
          open ? 'max-h-[3000px]' : 'max-h-32'
        }`}
      >
        <div className="space-y-2.5">
          {paragraphs.map((para, i) => (
            <p key={i} className="text-[15px] leading-[1.7] text-gray-300 max-w-prose">
              {para}
            </p>
          ))}
        </div>

        {/* Desvanece el corte para que no parezca texto cortado por un bug. */}
        {!open && overflows && (
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-rock-dark to-transparent pointer-events-none" />
        )}
      </div>

      {overflows && (
        <button onClick={() => setOpen(!open)} className="btn btn-ghost text-[13px] mt-2 -ml-2">
          {open ? 'Ver menos' : 'Seguir leyendo'}
        </button>
      )}
    </div>
  )
}

export default function ArtistDetail() {
  const { slug } = useParams()
  const [albumFilter, setAlbumFilter] = useState('album')

  const { data, isLoading, error, refetch } = useQuery({
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

  if (isLoading) return <div className="py-11"><SkeletonFicha lines={5} /></div>
  if (error) return <ErrorState title="No pudimos traer esta banda." onRetry={refetch} />
  if (!artist) return <NotFoundLine>Artista no encontrado.</NotFoundLine>

  const filtered = albums.filter(a => a.album_type === albumFilter)
  const rating = artist.avg_rating ? parseFloat(artist.avg_rating).toFixed(1) : null

  return (
    <div className="animate-fade-up">
      {/* — Ficha — */}
      <div className="flex flex-wrap gap-9 py-8 items-start">
        <div className="w-40 h-40 md:w-[232px] md:h-[232px] flex-none rounded-xl overflow-hidden
                        bg-rock-card shadow-card">
          {artist.image_url ? (
            <img src={artist.image_url} alt={artist.name} className="w-full h-full object-cover washed" />
          ) : (
            <div className="w-full h-full grid place-items-center bg-rock-border">
              <span className="font-display text-5xl text-gray-500">
                {artist.name?.[0]?.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-[300px]">
          <p className="kicker mb-3">
            {[artist.country, originLabel(artist)].filter(Boolean).join(' · ') || 'Banda'}
          </p>
          <h1 className="text-screen mb-4">{artist.name}</h1>

          {rating && (
            <div className="flex gap-2 flex-wrap mb-5">
              <span className="tag tag-neutral">★ {rating}</span>
            </div>
          )}

          <div className="flex gap-2.5 flex-wrap mb-5">
            <FavoriteButton entityType="artist" entityId={artist.id} />
          </div>

          {artist.bio && <Bio text={artist.bio} />}
        </div>
      </div>

      {/* — Discografía — */}
      <section className="mb-16">
        <div className="flex items-baseline gap-4 flex-wrap mb-3">
          <h2 className="font-display text-3xl">Discografía</h2>
          <div className="seg ml-auto">
            {[
              { value: 'album', label: 'Álbumes' },
              { value: 'single', label: 'Sencillos y EP' },
            ].map(({ value, label }) => (
              <label key={value} className="seg-opt">
                <input
                  type="radio"
                  name="disco"
                  checked={albumFilter === value}
                  onChange={() => setAlbumFilter(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
        <p className="text-[12.5px] text-gray-500 mb-6 hidden md:block">
          Pasá el mouse por un disco para sacarlo de la funda.
        </p>

        {data?.ingestingAlbums ? (
          <SkeletonGrid count={5} min={168} />
        ) : filtered.length === 0 ? (
          <EmptyState title="Nada por acá">
            {albumFilter === 'album'
              ? 'Esta banda todavía no tiene álbumes fichados.'
              : 'No hay sencillos ni EP cargados.'}
          </EmptyState>
        ) : (
          <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(168px,1fr))' }}>
            {filtered.map(a => <AlbumCard key={a.id} album={a} />)}
          </div>
        )}
      </section>

      {/* — Formación — */}
      {people.length > 0 && (
        <section className="mb-16">
          <h2 className="font-display text-3xl mb-1.5">Quiénes pasaron por la banda</h2>
          <p className="text-[13.5px] text-gray-500 mb-6">
            {people.length} {people.length === 1 ? 'músico' : 'músicos'}. Las barras son las etapas de cada uno.
          </p>

          {/*
            En desktop van al lado: el gráfico necesita ancho para que los años
            se separen, y la lista es angosta por naturaleza. Apilados dejaban
            media pantalla vacía a la derecha del gráfico. Abajo de lg vuelven a
            apilarse, que es la única forma de que el gráfico entre.
          */}
          <div className="grid gap-5 lg:grid-cols-5">
            <div className="card lg:col-span-3">
              <MemberTimeline people={people} />
            </div>

            <div className="space-y-4 lg:col-span-2">
              {current.length > 0 && former.length > 0 ? (
                <>
                  <div className="card !py-4">
                    <p className="kicker mb-2">Formación actual</p>
                    <MemberList people={current} />
                  </div>
                  <div className="card !py-4">
                    <p className="kicker mb-2">Pasaron antes</p>
                    <MemberList people={former} />
                  </div>
                </>
              ) : (
                <div className="card !py-4">
                  <MemberList people={people} />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* — Trayectoria, para un solista — */}
      {bandsPlayedIn.length > 0 && (
        <section className="mb-16">
          <h2 className="font-display text-3xl mb-5">Bandas</h2>
          <div className="max-w-2xl card !p-0 divide-y divide-rock-border">
            {bandsPlayedIn.map(band => (
              <div key={band.key} className="flex items-baseline gap-3 p-4 flex-wrap">
                {band.slug ? (
                  <Link to={`/artist/${band.slug}`} className="font-medium hover:text-rock-accent">
                    {band.name}
                  </Link>
                ) : (
                  <span className="font-medium">{band.name}</span>
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

      {/* — Opiniones — */}
      <section>
        <h2 className="font-display text-3xl mb-5">Lo que escribieron</h2>
        <div className="max-w-2xl space-y-4">
          <ReviewForm entityType="artist" entityId={artist.id} onSubmit={createReview} />
          {reviews.length === 0 ? (
            <EmptyState title="Todavía nadie escribió">
              Sé el primero en decir algo sobre {artist.name}.
            </EmptyState>
          ) : (
            reviews.map(r => (
              <ReviewCard key={r.id} review={r} onDelete={() => deleteReview(r.id)} />
            ))
          )}
        </div>
      </section>
    </div>
  )
}
