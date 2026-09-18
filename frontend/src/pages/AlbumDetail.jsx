import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AlbumLineup from '../components/common/AlbumLineup'
import TrackRow from '../components/common/TrackRow'
import TrackPanel from '../components/common/TrackPanel'
import ArrowLink from '../components/common/ArrowLink'
import Vinyl from '../components/common/Vinyl'
import FavoriteButton from '../components/common/FavoriteButton'
import PlatformBadges, { youtubeMusicSearch } from '../components/common/PlatformBadges'
import ReviewCard from '../components/common/ReviewCard'
import ReviewForm from '../components/forms/ReviewForm'
import { EmptyState, ErrorState, NotFoundLine, SkeletonFicha, SkeletonRows } from '../components/common/States'
import { IconArrowLeft, IconArrowRight } from '../components/common/Icons'
import { getAlbum } from '../services/api'
import { albumYear } from '../services/dates'
import { discAt, discGroups, sortTracks, trackNum } from '../services/tracks'
import { useReviews } from '../hooks/useReviews'

const TYPE_LABEL = { album: 'Álbum', single: 'Sencillo', ep: 'EP' }

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

  /*
   * El tema bajo el mouse, sea en un surco o en un renglón, por posición en la
   * lista — no por `track_number`: un disco doble numera 1..n dos veces, y así
   * se prendían dos renglones a la vez. Manda sobre el abierto para resaltar,
   * pero no lo cambia.
   */
  const [hoverPos, setHoverPos] = useState(null)
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
  // Por disco y después por pista: el backend ya los manda así, pero un disco
  // fichado antes del arreglo puede venir intercalado.
  const tracks = useMemo(() => sortTracks(data?.tracks), [data?.tracks])
  const discs = useMemo(() => discGroups(tracks), [tracks])
  const artist = data?.artist
  const links = data?.links || {}

  const openIndex = temaId ? tracks.findIndex(t => t.id === temaId) : -1
  const openTrack = openIndex >= 0 ? tracks[openIndex] : null
  const openPos = openIndex >= 0 ? openIndex + 1 : null

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

  const litPos = hoverPos || openPos
  const caption = litPos ? tracks[litPos - 1] : null

  /*
   * En un doble el vinilo muestra un disco por vez: los surcos son los de la
   * canción que estás mirando, y al pasar al disco 2 se redibuja desde el
   * borde, como poner el otro vinilo en la bandeja.
   */
  const side = discAt(discs, litPos)
  const sideTracks = side.items.map(it => it.track)
  const sidePos = side.items.findIndex(it => it.pos === litPos) + 1

  return (
    <div className="animate-fade-up">
      {/* "Volver" va a la banda, no a history.back(): quien llegó por un link
          directo también tiene que poder subir un nivel. */}
      {artist && (
        <ArrowLink back to={`/artist/${artist.slug}`} className="mt-4">{artist.name}</ArrowLink>
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
              tracks={sideTracks}
              album={{ ...album, artist_name: artist?.name }}
              activeTrack={sidePos}
              spinning={!!openTrack}
              height={mobile ? 300 : 520}
              onHover={n => setHoverPos(n ? side.items[n - 1]?.pos ?? null : null)}
              onSelect={n => {
                const t = side.items[n - 1]?.track
                if (t) openTema(t, { replace: !!openTrack })
              }}
            />

            {/*
              El desplazador, centrado bajo el vinilo: "← 1. Nombre de la
              canción →". El centro tiene alto fijo y el título va a dos
              renglones como mucho, así las flechas no se corren bajo el dedo
              al pasar de tema — igual que el de los discos en la pila.
            */}
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-5
                            w-full max-w-[520px] mx-auto mt-2 md:mt-3">
              <button onClick={() => step(-1)} className="btn btn-secondary btn-icon flex-none" aria-label="Canción anterior">
                <IconArrowLeft size={18} />
              </button>

              <div key={caption?.id || 'none'} className="min-w-0 h-[58px] flex items-center justify-center animate-fade-up">
                <p className="font-display text-[19px] sm:text-[22px] leading-[1.15] text-center text-balance line-clamp-2">
                  {caption
                    ? `${trackNum(caption, litPos - 1)}. ${caption.title}`
                    : 'Elegí una canción'}
                </p>
              </div>

              <button onClick={() => step(1)} className="btn btn-secondary btn-icon flex-none" aria-label="Canción siguiente">
                <IconArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        <section
          ref={columnRef}
          className="flex-1 min-w-[280px] overflow-x-clip"
          onMouseLeave={() => setHoverPos(null)}
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
                discs.map(d => (
                  <div key={d.disc}>
                    {/* Los discos de un doble se separan; uno solo no lleva título. */}
                    {discs.length > 1 && (
                      <p className="kicker mt-4 first:mt-0 mb-1.5">Disco {d.disc}</p>
                    )}
                    {d.items.map(({ track, pos }) => (
                      <TrackRow
                        key={track.id}
                        track={track}
                        index={pos - 1}
                        selected={hoverPos === pos}
                        onHover={() => setHoverPos(pos)}
                        onOpen={() => openTema(track)}
                      />
                    ))}
                  </div>
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
