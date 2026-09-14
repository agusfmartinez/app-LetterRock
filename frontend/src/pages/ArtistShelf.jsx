import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { EmptyState, ErrorState, NotFoundLine, SkeletonFicha } from '../components/common/States'
import { IconArrowLeft } from '../components/common/Icons'
import { getAlbum, getArtist } from '../services/api'
import { albumYear, trackDuration } from '../services/dates'

const KIND = { album: 'álbum', single: 'sencillo', ep: 'EP' }

/**
 * La discografía como vitrina 3D (`<shelf-3d>`, en shelf3d.js).
 *
 * Tres estados que maneja el elemento y que acá se reflejan en la interfaz:
 *   browse → las fundas apiladas o en fila, se recorren con rueda o arrastre;
 *   focus  → una funda al frente, con su nombre abajo;
 *   split  → la funda a un costado y el vinilo afuera: cada surco es un tema.
 *
 * El elemento avisa los cambios con `shelf-mode`; el botón de volver los manda
 * de este lado con el atributo `mode`. Como con el vinilo, los atributos se
 * escriben a mano: React no los pasa bien a un custom element.
 */
export default function ArtistShelf() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const ref = useRef(null)
  const [layout, setLayout] = useState('stack')
  const [mode, setMode] = useState('browse')
  const [focus, setFocus] = useState(0)

  // Misma clave que la ficha: si venís de ahí, ya está en caché.
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['artist', slug],
    queryFn: () => getArtist(slug),
  })
  const artist = data?.artist

  /*
   * Orden cronológico: "disco por disco" es de a uno y en orden. Sólo álbumes,
   * salvo que no haya ninguno: veinte sencillos mezclados tapaban los discos.
   */
  const albums = useMemo(() => {
    const all = data?.albums || []
    const pick = all.some(a => a.album_type === 'album') ? all.filter(a => a.album_type === 'album') : all
    return [...pick].sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''))
  }, [data])

  const current = albums[focus] || albums[0]

  /*
   * Los temas se piden recién al abrir un disco: son una consulta por disco, y
   * la ficha del disco los ingesta si todavía no están (de ahí el reintento).
   */
  const { data: albumData } = useQuery({
    queryKey: ['album', current?.id],
    queryFn: () => getAlbum(current.id),
    enabled: !!current && mode !== 'browse',
    refetchInterval: (query) => (query.state.data?.ingestingTracks ? 1000 : false),
  })
  const tracks = useMemo(() => {
    if (!albumData || albumData.album?.id !== current?.id) return []
    return albumData.tracks || []
  }, [albumData, current])

  /* three pesa: se baja sólo al entrar a esta pantalla. */
  useEffect(() => {
    import('../components/common/shelf3d.js').catch(err => {
      console.error('No se pudo cargar la vitrina 3D:', err)
    })
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMode = e => {
      setMode(e.detail.mode)
      setFocus(e.detail.index)
    }
    const onTrack = e => {
      const t = tracks[e.detail.n - 1]
      if (t) navigate(`/track/${t.id}`)
    }
    el.addEventListener('shelf-mode', onMode)
    el.addEventListener('shelf-track', onTrack)
    return () => {
      el.removeEventListener('shelf-mode', onMode)
      el.removeEventListener('shelf-track', onTrack)
    }
  }, [tracks, navigate, albums.length])

  const albumsAttr = useMemo(
    () => JSON.stringify(albums.map(a => ({ title: a.title, cover: a.cover_url || null }))),
    [albums]
  )
  // `n` es la posición y no `track_number`: en un disco doble la numeración
  // vuelve a 1 y dos surcos con el mismo número se pisarían.
  const tracksAttr = useMemo(
    () => JSON.stringify(tracks.map((t, i) => ({ n: i + 1, title: t.title, dur: trackDuration(t) || '3:00' }))),
    [tracks]
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.setAttribute('albums', albumsAttr)
    el.setAttribute('tracks', tracksAttr)
    el.setAttribute('layout', layout)
    el.setAttribute('mode', mode)
    el.setAttribute('sel', String(focus))
    el.setAttribute('accent', '#c1592c')
    el.setAttribute('artist', artist?.name || '')
  }, [albumsAttr, tracksAttr, layout, mode, focus, artist])

  if (isLoading) return <div className="py-11"><SkeletonFicha lines={3} /></div>
  if (error) return <ErrorState title="No pudimos traer esta banda." onRetry={refetch} />
  if (!artist) return <NotFoundLine>Artista no encontrado.</NotFoundLine>

  const browsing = mode === 'browse'
  const year = albumYear(current)

  return (
    <div className="animate-fade-up">
      <Link
        to={`/artist/${slug}`}
        className="inline-flex items-center gap-2 text-[13.5px] text-gray-400 hover:text-rock-accent pt-7"
      >
        <IconArrowLeft size={14} /> {artist.name}
      </Link>

      <div className="flex items-end gap-6 flex-wrap pt-3.5 pb-6">
        <div className="flex-1 min-w-[300px]">
          <p className="kicker mb-2.5">Discografía en 3D</p>
          <h1 className="font-display text-[clamp(34px,4.6vw,54px)] leading-[0.98] mb-3">
            {artist.name}, disco por disco
          </h1>
          <p className="text-[14.5px] leading-relaxed text-gray-300 max-w-[56ch]">
            Scrolleá sobre la vitrina para recorrer los discos. Un clic abre la funda; otro clic
            saca el vinilo, y ahí cada surco es un tema.
          </p>
        </div>
        {albums.length > 1 && (
          <div className="seg flex-none">
            {[
              { value: 'stack', label: 'Apilados' },
              { value: 'row', label: 'En fila' },
            ].map(({ value, label }) => (
              <label key={value} className="seg-opt whitespace-nowrap">
                <input
                  type="radio"
                  name="vitrina"
                  checked={layout === value}
                  onChange={() => setLayout(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {albums.length === 0 ? (
        <EmptyState
          title="Nada para mostrar"
          action={<Link to={`/artist/${slug}`} className="btn btn-secondary">Volver a la ficha</Link>}
        >
          Esta banda todavía no tiene discos fichados.
        </EmptyState>
      ) : (
        <div
          className="relative h-[min(74vh,640px)] min-h-[440px] rounded-3xl overflow-hidden shadow-card mb-8"
          style={{ background: 'radial-gradient(120% 90% at 50% 8%, #2e241d 0%, #1b1613 38%, #100d0b 72%)' }}
        >
          <shelf-3d ref={ref} style={{ position: 'absolute', inset: 0 }}>
            {/* Las etiquetas de los surcos: el elemento las posiciona y las
                muestra cuando el mouse pasa por el surco de ese tema. */}
            {mode === 'split' && tracks.map((t, i) => (
              <button
                key={t.id}
                type="button"
                data-shelf-track={i + 1}
                onClick={() => navigate(`/track/${t.id}`)}
                className="w-[170px] text-left leading-snug bg-rock-cardHover rounded-md px-3 py-2 shadow-card opacity-0"
              >
                <span className="block text-[13.5px] font-semibold text-rock-text">{t.title}</span>
                <span className="block font-mono text-[11px] text-gray-500 mt-0.5">
                  {i + 1} · {trackDuration(t) || '—'}
                </span>
              </button>
            ))}
          </shelf-3d>

          <div className="absolute inset-0 pointer-events-none">
            <button
              type="button"
              onClick={() => setMode(mode === 'split' ? 'focus' : 'browse')}
              aria-label="Volver al listado"
              className={`btn btn-secondary btn-icon absolute top-[18px] left-[18px] transition-opacity duration-300 ${
                browsing ? 'opacity-0' : 'opacity-100 pointer-events-auto'
              }`}
            >
              <IconArrowLeft size={18} />
            </button>

            <p
              className={`absolute left-6 bottom-6 max-w-[26ch] text-[12.5px] leading-normal text-gray-400
                          transition-opacity duration-300 ${browsing ? 'opacity-100' : 'opacity-0'}`}
            >
              {layout === 'stack'
                ? 'Scrolleá o arrastrá para pasar los discos de la pila. Clic para abrir.'
                : 'Scrolleá o arrastrá para correr la fila. Clic para abrir.'}
            </p>

            <div
              className={`absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 text-center px-6 pb-6 pt-[72px]
                          transition-[opacity,transform] duration-[450ms] delay-100 ${
                browsing ? 'opacity-0 translate-y-[18px]' : 'opacity-100 translate-y-0'
              }`}
              style={{ background: 'linear-gradient(to top, #100d0b 8%, rgba(16,13,11,0.88) 52%, rgba(16,13,11,0) 100%)' }}
            >
              <h2 className="font-display text-[clamp(23px,2.5vw,32px)] leading-[1.18] max-w-[24ch] text-balance">
                {current?.title}
              </h2>
              <p className="font-mono text-[12px] tracking-[0.14em] uppercase text-gray-500">
                {[year, KIND[current?.album_type]].filter(Boolean).join(' · ')}
                {mode === 'split' && albumData?.ingestingTracks && ' · trayendo los temas…'}
              </p>
              {!browsing && current && (
                <Link
                  to={`/album/${current.id}`}
                  className="btn btn-secondary !min-h-0 !px-4 !py-2 !text-[13px] pointer-events-auto"
                >
                  Abrir la ficha del disco
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-5 mb-16">
        <div className="card flex-1 min-w-[280px]">
          <p className="kicker mb-2.5">Cómo se recorre</p>
          <p className="text-[14px] leading-relaxed text-gray-300">
            Rueda del mouse o flechas del teclado para pasar de disco. Enter abre el que está
            adelante, Escape vuelve atrás.
          </p>
        </div>
        <div className="card flex-1 min-w-[280px]">
          <p className="kicker mb-2.5">Los surcos</p>
          <p className="text-[14px] leading-relaxed text-gray-300">
            Cada banda del vinilo mide lo que dura el tema, igual que en el disco real. Pasá el
            mouse por encima para verlo; un clic abre el tema.
          </p>
        </div>
      </div>
    </div>
  )
}
