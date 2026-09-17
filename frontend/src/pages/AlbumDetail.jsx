import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AlbumLineup from '../components/common/AlbumLineup'
import TrackRow from '../components/common/TrackRow'
import TrackPanel from '../components/common/TrackPanel'
import Vinyl from '../components/common/Vinyl'
import FavoriteButton from '../components/common/FavoriteButton'
import PlatformBadges, { youtubeMusicSearch } from '../components/common/PlatformBadges'
import ReviewCard from '../components/common/ReviewCard'
import ReviewForm from '../components/forms/ReviewForm'
import { EmptyState, ErrorState, NotFoundLine, SkeletonFicha, SkeletonRows } from '../components/common/States'
import { IconArrowLeft, IconArrowRight } from '../components/common/Icons'
import { getAlbum } from '../services/api'
import { albumYear, trackDuration } from '../services/dates'
import { useReviews } from '../hooks/useReviews'

const TYPE_LABEL = { album: 'Álbum', single: 'Sencillo', ep: 'EP' }

const trackNum = (t, i) => t.track_number ?? i + 1

export default function AlbumDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()

  /*
   * La canción no tiene página propia: es un modo de la ficha del disco. El
   * tema abierto vive en la URL (`?tema=`) para que se pueda compartir y para
   * que el "atrás" del navegador lo cierre.
   */
  const temaId = params.get('tema')

  // El tema bajo el mouse, sea en un surco o en un renglón. Manda sobre el
  // abierto para resaltar, pero no lo cambia.
  const [hoverTrack, setHoverTrack] = useState(null)
  // Hacia dónde se desliza la columna: adelante al abrir, atrás al volver.
  const [dir, setDir] = useState('fwd')
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  const columnRef = useRef(null)

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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

  const openIndex = temaId ? tracks.findIndex(t => t.id === temaId) : -1
  const openTrack = openIndex >= 0 ? tracks[openIndex] : null
  const openNum = openTrack ? trackNum(openTrack, openIndex) : null

  // Las opiniones de abajo son las del tema abierto, o las del disco.
  const { reviews, createReview, deleteReview } = useReviews(
    temaId ? 'track' : 'album',
    temaId || id
  )

  /*
   * Abrir desde la lista suma una entrada al historial (el "atrás" vuelve a la
   * lista). Pasar de tema con las flechas la reemplaza: si no, volver a la
   * lista costaría un "atrás" por cada tema recorrido.
   */
  const openTema = useCallback((t, { replace = false } = {}) => {
    setDir('fwd')
    setParams(p => {
      const next = new URLSearchParams(p)
      next.set('tema', t.id)
      return next
    }, { replace, state: { tema: true } })
  }, [setParams])

  const closeTema = useCallback(() => {
    setDir('back')
    if (location.state?.tema) { navigate(-1); return }
    setParams(p => {
      const next = new URLSearchParams(p)
      next.delete('tema')
      return next
    }, { replace: true })
  }, [location.state, navigate, setParams])

  // Un `?tema=` que no es de este disco no abre nada: se limpia.
  useEffect(() => {
    if (temaId && tracks.length > 0 && openIndex < 0 && !data?.ingestingTracks) {
      setParams(p => {
        const next = new URLSearchParams(p)
        next.delete('tema')
        return next
      }, { replace: true })
    }
  }, [temaId, tracks.length, openIndex, data?.ingestingTracks, setParams])

  /* Las flechas pasan de tema con wrap; sin tema abierto, abren el primero. */
  const step = useCallback((delta) => {
    if (tracks.length === 0) return
    if (openIndex < 0) { openTema(tracks[0]); return }
    const next = tracks[(openIndex + delta + tracks.length) % tracks.length]
    openTema(next, { replace: true })
  }, [tracks, openIndex, openTema])

  useEffect(() => {
    const onKey = (e) => {
      // Con el foco en un campo, las flechas mueven el cursor, no el disco.
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  // En celular la columna queda debajo del vinilo: si al cambiar quedó su
  // principio fuera de la pantalla, se sube hasta ahí.
  const lastTema = useRef(temaId)
  useLayoutEffect(() => {
    if (lastTema.current === temaId) return
    lastTema.current = temaId
    const el = columnRef.current
    if (!el || !mobile) return
    const top = el.getBoundingClientRect().top
    if (top < 72) window.scrollTo({ top: window.scrollY + top - 80, behavior: 'smooth' })
  }, [temaId, mobile])

  if (isLoading) return <div className="py-11"><SkeletonFicha lines={5} /></div>
  if (error) return <ErrorState title="No pudimos traer este disco." onRetry={refetch} />
  if (!album) return <NotFoundLine>Álbum no encontrado.</NotFoundLine>

  const year = albumYear(album)
  const rating = album.avg_rating ? parseFloat(album.avg_rating).toFixed(1) : null

  const litNum = hoverTrack || openNum
  const caption = tracks.find((t, i) => trackNum(t, i) === litNum)

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
            className="vinyl-disc vinyl-disc--quiet absolute top-[4%] left-0 w-[92%] aspect-square
                       duration-[600ms] ease-out group-hover:translate-x-[26%]"
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

      {/* — Vinilo + canciones (o el tema abierto) — */}
      <div className="flex flex-wrap gap-x-9 gap-y-4 items-start mb-8">
        {tracks.length > 0 && (
          /* En escritorio el vinilo acompaña el scroll: la lista o la letra
             pueden ser más largas que él. */
          <div className="w-full md:w-auto md:flex-1 min-w-[280px] md:min-w-[320px] md:sticky md:top-20">
            <Vinyl
              tracks={tracks}
              album={{ ...album, artist_name: artist?.name }}
              activeTrack={litNum}
              spinning={!!openTrack}
              height={mobile ? 300 : 520}
              onHover={n => setHoverTrack(n || null)}
              onSelect={n => {
                const i = tracks.findIndex((x, j) => trackNum(x, j) === n)
                if (i >= 0) openTema(tracks[i], { replace: !!openTrack })
              }}
            />

            {/* Flechas fijas arriba a la izquierda: el título puede ocupar varias
                líneas y no tiene que moverlas ni achicarlas. */}
            <div className="flex items-start gap-3.5 mt-2 md:mt-4 min-h-[84px]">
              <button onClick={() => step(-1)} className="btn btn-secondary btn-icon flex-none" aria-label="Canción anterior">
                <IconArrowLeft size={16} />
              </button>
              <button onClick={() => step(1)} className="btn btn-secondary btn-icon flex-none" aria-label="Canción siguiente">
                <IconArrowRight size={16} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[9.5px] tracking-[0.16em] text-gray-500 mb-1.5 flex gap-3">
                  <span>{caption ? `PISTA ${litNum}` : 'ELEGÍ UNA CANCIÓN'}</span>
                  {caption && trackDuration(caption) && (
                    <span className="ml-auto">{trackDuration(caption)}</span>
                  )}
                </p>
                <p className="font-display text-[22px] leading-[1.15] break-words">
                  {caption?.title || '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        <section
          ref={columnRef}
          className="flex-1 min-w-[280px] overflow-x-clip"
          onMouseLeave={() => setHoverTrack(null)}
        >
          {openTrack ? (
            <div key={openTrack.id} className={dir === 'back' ? 'slide-from-left' : 'slide-from-right'}>
              <TrackPanel
                inPage
                track={openTrack}
                artistName={artist?.name}
                albumId={id}
                onBack={closeTema}
              />
            </div>
          ) : (
            <div key="list" className={dir === 'back' ? 'slide-from-left' : ''}>
              <h2 className="font-display text-3xl mb-3.5">Canciones</h2>

              {data?.ingestingTracks ? (
                <SkeletonRows count={6} avatar={false} />
              ) : tracks.length === 0 ? (
                <EmptyState title="Sin canciones">
                  Todavía no cargamos el tracklist de este disco.
                </EmptyState>
              ) : (
                tracks.map((t, i) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    index={i}
                    selected={hoverTrack === trackNum(t, i)}
                    onHover={setHoverTrack}
                    onOpen={() => openTema(t)}
                  />
                ))
              )}
            </div>
          )}
        </section>
      </div>

      {/* — Opiniones — del tema abierto o del disco. */}
      <section className="border-t border-rock-border pt-8">
        <h2 className="font-display text-3xl mb-5">
          {openTrack ? <>Opiniones sobre <span className="text-rock-accent">{openTrack.title}</span></> : 'Lo que escribieron'}
        </h2>
        <div className="max-w-2xl space-y-4">
          <ReviewForm
            key={temaId || id}
            entityType={temaId ? 'track' : 'album'}
            entityId={temaId || id}
            onSubmit={createReview}
          />
          {reviews.length === 0 ? (
            <EmptyState title="Todavía nadie escribió">
              {openTrack
                ? 'Sé el primero en decir algo sobre esta canción.'
                : 'Sé el primero en decir algo sobre este disco.'}
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
