import { useCallback, useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AlbumLineup from '../components/common/AlbumLineup'
import TrackRow from '../components/common/TrackRow'
import Vinyl from '../components/common/Vinyl'
import FavoriteButton from '../components/common/FavoriteButton'
import PlatformBadges, { youtubeMusicSearch } from '../components/common/PlatformBadges'
import ReviewCard from '../components/common/ReviewCard'
import ReviewForm from '../components/forms/ReviewForm'
import { EmptyState, ErrorState, NotFoundLine, SkeletonFicha, SkeletonRows } from '../components/common/States'
import { IconArrowLeft } from '../components/common/Icons'
import { getAlbum } from '../services/api'
import { albumYear, trackDuration } from '../services/dates'
import { useReviews } from '../hooks/useReviews'

const TYPE_LABEL = { album: 'Álbum', single: 'Sencillo', ep: 'EP' }

export default function AlbumDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  /*
   * Un solo `activeTrack` gobierna el vinilo y la lista: el surco resaltado y
   * el renglón resaltado son el mismo dato. Vive acá, en el padre de los dos,
   * y no dentro de ninguno — si viviera en el vinilo, la lista no podría
   * moverlo.
   */
  const [activeTrack, setActiveTrack] = useState(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['album', id],
    queryFn: () => getAlbum(id),
    refetchInterval: (query) => {
      const d = query.state.data
      return d?.ingestingTracks ? 1000 : false
    },
  })

  const album = data?.album
  const tracks = data?.tracks || []
  const artist = data?.artist
  const links = data?.links || {}
  const { reviews, createReview, deleteReview } = useReviews('album', id)

  /* Las flechas mueven la selección con wrap: del último se vuelve al primero. */
  const step = useCallback((delta) => {
    if (tracks.length === 0) return
    setActiveTrack(prev => {
      const nums = tracks.map((t, i) => t.track_number ?? i + 1)
      if (prev == null) return nums[0]
      const at = nums.indexOf(prev)
      return nums[(at + delta + nums.length) % nums.length]
    })
  }, [tracks])

  useEffect(() => {
    const onKey = (e) => {
      // Con el foco en un campo, las flechas mueven el cursor, no el disco.
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  if (isLoading) return <div className="py-11"><SkeletonFicha lines={5} /></div>
  if (error) return <ErrorState title="No pudimos traer este disco." onRetry={refetch} />
  if (!album) return <NotFoundLine>Álbum no encontrado.</NotFoundLine>

  const year = albumYear(album)
  const rating = album.avg_rating ? parseFloat(album.avg_rating).toFixed(1) : null

  /* Los lados son una convención del vinilo, no un dato: la mitad de arriba es
     el lado A. Con menos de seis canciones no se parte — un EP no tiene lados. */
  const split = tracks.length >= 6 ? Math.ceil(tracks.length / 2) : tracks.length
  const sides = [
    { label: 'Lado A', items: tracks.slice(0, split) },
    { label: 'Lado B', items: tracks.slice(split) },
  ].filter(s => s.items.length > 0)

  const nowPlaying = tracks.find((t, i) => (t.track_number ?? i + 1) === activeTrack)

  return (
    <div className="animate-fade-up">
      {/* "Volver" va a la banda, no a history.back(): quien llegó por un link
          directo también tiene que poder subir un nivel. */}
      {artist && (
        <Link
          to={`/artist/${artist.slug}`}
          className="inline-flex items-center gap-2 text-[13.5px] text-gray-400 hover:text-rock-accent pt-4"
        >
          <IconArrowLeft size={14} /> {artist.name}
        </Link>
      )}

      {/* — Ficha — */}
      <div className="flex flex-wrap gap-8 lg:gap-12 py-7 items-start">
        <div className="w-52 md:w-[286px] flex-none relative aspect-square group">
          <span
            aria-hidden="true"
            className="absolute top-[4%] left-0 w-[92%] aspect-square rounded-full shadow-card-hover
                       transition-transform duration-[600ms] ease-out group-hover:translate-x-[26%]"
            style={{
              background: `
                radial-gradient(circle at 50% 50%, #100d0b 0 3.4%, transparent 3.6%),
                radial-gradient(circle at 50% 50%, #c1592c 3.6% 26%, transparent 26.5%),
                repeating-radial-gradient(circle at 50% 50%, #241d18 0 2.5px, #17120f 2.5px 5px)
              `,
            }}
          />
          <div className="absolute inset-0 rounded-xl overflow-hidden bg-rock-card shadow-card">
            {album.cover_url ? (
              <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover washed" />
            ) : (
              <div className="w-full h-full flex flex-col justify-end p-5 bg-rock-border">
                <span className="font-display text-2xl leading-tight text-gray-300">{album.title}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-[300px]">
          <p className="kicker mb-3">
            {[TYPE_LABEL[album.album_type] || 'Álbum', year, artist?.name].filter(Boolean).join(' · ')}
          </p>
          <h1 className="text-screen mb-4">{album.title}</h1>

          {(rating || tracks.length > 0) && (
            <div className="flex items-baseline gap-4 flex-wrap mb-5">
              {rating && <span className="font-display text-4xl text-rock-accent leading-none">{rating}</span>}
              <span className="text-[13px] text-gray-500">
                {[
                  album.rating_count ? `de ${album.rating_count} puntajes` : null,
                  tracks.length ? `${tracks.length} canciones` : null,
                ].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}

          <div className="flex gap-2.5 flex-wrap mb-5">
            <FavoriteButton entityType="album" entityId={id} />
            <PlatformBadges
              links={links}
              fallbacks={{ youtube: youtubeMusicSearch(`${artist?.name || ''} ${album.title}`) }}
            />
          </div>

          {album.description && (
            <div className="space-y-3 mb-5">
              {album.description.split(/\n+/).filter(Boolean).map((p, i) => (
                <p key={i} className="text-[15px] leading-[1.7] text-gray-300 max-w-prose">{p}</p>
              ))}
            </div>
          )}

          {/* Formación del año del disco. Derivada de las fechas del artista. */}
          <AlbumLineup artistId={artist?.id} year={year} variant="badges" />
        </div>
      </div>

      {/* — Vinilo + canciones — */}
      <div className="flex flex-wrap gap-9 items-start mb-8">
        {tracks.length > 0 && (
          /* El vinilo se esconde en mobile: no se achica ni se rota, y a
             ancho de teléfono no queda espacio para las etiquetas. */
          <div className="hidden md:block flex-1 min-w-[320px]">
            <Vinyl
              tracks={tracks}
              album={{ ...album, artist_name: artist?.name }}
              activeTrack={activeTrack}
              onHover={setActiveTrack}
              onSelect={n => {
                const t = tracks.find((x, i) => (x.track_number ?? i + 1) === n)
                if (t) navigate(`/track/${t.id}`)
              }}
            />

            <div className="flex items-center gap-3.5 mt-4">
              <button onClick={() => step(-1)} className="btn btn-secondary btn-icon" aria-label="Canción anterior">←</button>
              <button onClick={() => step(1)} className="btn btn-secondary btn-icon" aria-label="Canción siguiente">→</button>
              <div className="min-w-0">
                <p className="font-mono text-[9.5px] tracking-[0.16em] text-gray-500 mb-1">
                  {nowPlaying ? `PISTA ${activeTrack}` : 'ELEGÍ UNA CANCIÓN'}
                </p>
                <p className="font-display text-[22px] leading-none truncate">
                  {nowPlaying?.title || '—'}
                </p>
              </div>
              {nowPlaying && (
                <span className="ml-auto font-mono text-[12.5px] text-gray-500">
                  {trackDuration(nowPlaying) || ''}
                </span>
              )}
            </div>
          </div>
        )}

        <section
          className="flex-1 min-w-[280px]"
          onMouseLeave={() => setActiveTrack(null)}
        >
          <div className="flex items-baseline gap-3.5 mb-3.5">
            <h2 className="font-display text-3xl">Canciones</h2>
            <span className="text-[12.5px] text-gray-500 hidden md:inline">
              pasá por el vinilo o por la lista
            </span>
          </div>

          {data?.ingestingTracks ? (
            <SkeletonRows count={6} avatar={false} />
          ) : tracks.length === 0 ? (
            <EmptyState title="Sin canciones">
              Todavía no cargamos el tracklist de este disco.
            </EmptyState>
          ) : (
            sides.map(side => (
              <div key={side.label}>
                {sides.length > 1 && (
                  <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 h-8 flex items-end pb-1.5">
                    {side.label.toUpperCase()}
                  </p>
                )}
                {side.items.map((t, i) => {
                  const n = t.track_number ?? tracks.indexOf(t) + 1
                  return (
                    <TrackRow
                      key={t.id}
                      track={t}
                      index={tracks.indexOf(t)}
                      selected={activeTrack === n}
                      onHover={setActiveTrack}
                    />
                  )
                })}
              </div>
            ))
          )}
        </section>
      </div>

      {/* — Opiniones — */}
      <section className="border-t border-rock-border pt-8">
        <h2 className="font-display text-3xl mb-5">Lo que escribieron</h2>
        <div className="flex flex-wrap gap-8 items-start">
          <div className="flex-1 min-w-[280px] max-w-sm">
            <ReviewForm entityType="album" entityId={id} onSubmit={createReview} />
          </div>
          <div className="flex-1 min-w-[300px] space-y-4">
            {reviews.length === 0 ? (
              <EmptyState title="Todavía nadie escribió">
                Sé el primero en decir algo sobre este disco.
              </EmptyState>
            ) : (
              reviews.map(r => (
                <ReviewCard key={r.id} review={r} onDelete={() => deleteReview(r.id)} />
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
