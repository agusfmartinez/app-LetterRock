import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AlbumCard from './AlbumCard'
import TrackRow from './TrackRow'
import TrackPanel from './TrackPanel'
import ArrowLink from './ArrowLink'
import { EmptyState, SkeletonGrid, SkeletonRows } from './States'
import { IconArrowLeft, IconArrowRight } from './Icons'
import { getAlbum } from '../../services/api'
import { albumYear, trackDuration } from '../../services/dates'

const KIND = { album: 'álbum', single: 'sencillo', ep: 'EP' }

// Lo que dura el cambio de grilla a pila y vuelta. Coincide con la transición
// de alto del contenedor; las fundas usan su propia curva, que llega antes.
const MORPH_MS = 700

/* three pesa: se baja recién la primera vez que alguien pide la pila. */
let shelfModule = null
function loadShelf() {
  shelfModule ??= import('./shelf3d.js').then(() => customElements.whenDefined('shelf-3d'))
  return shelfModule
}

// Alto de la pila. No más del 85% de la ventana: la rueda sólo mueve discos
// con el panel entero a la vista, y tiene que poder entrar.
function shelfHeight() {
  const desktop = window.innerWidth >= 768
  return Math.max(420, Math.min(window.innerHeight * (desktop ? 0.85 : 0.7), desktop ? 820 : 580))
}

/*
 * Con el vinilo afuera, el panel se reparte en zonas — centro y ancho en
 * fracciones del panel. La escena 3D pone la funda y el disco en las suyas
 * (atributo `zones`) y el listado de canciones va apoyado sobre la que queda.
 *
 * En compu son tres columnas: funda, vinilo y canciones. En el teléfono no
 * entran: arriba van la funda y el vinilo, y la lista abajo a todo el ancho —
 * en media columna los títulos se cortaban a la tercera palabra.
 */
const ZONES = {
  desktop: {
    sleeve: { cx: 0.14, cy: 0.46, w: 0.2 },
    vinyl: { cx: 0.39, cy: 0.47, w: 0.29 },
    panel: { left: '55%', top: '8%', width: '41%', height: '76%' },
  },
  mobile: {
    sleeve: { cx: 0.26, cy: 0.19, w: 0.3 },
    vinyl: { cx: 0.7, cy: 0.2, w: 0.42 },
    panel: { left: '4%', top: '40%', width: '92%', height: '56%' },
  },
}

const zonesFor = (mobile) => {
  const z = mobile ? ZONES.mobile : ZONES.desktop
  return JSON.stringify({ sleeve: z.sleeve, vinyl: z.vinyl })
}

// Las tapas de la grilla, relativas al contenedor, en el orden en que están.
function measureCovers(wrap) {
  const base = wrap.getBoundingClientRect()
  return [...wrap.querySelectorAll('[data-album-cover]')].map(el => {
    const r = el.getBoundingClientRect()
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }
  })
}

/**
 * La discografía de un artista: grilla 2D o pila 3D, en el mismo lugar.
 *
 * La grilla es la vista por defecto — carga rápido, los discos son links de
 * verdad y se lee con cualquier cosa. La pila (`<shelf-3d>`) aparece a pedido
 * y no es otra pantalla: las tapas de la grilla vuelan hasta formar la pila, y
 * al volver cada funda regresa a su lugar.
 *
 * Cómo se hace el pase, en los dos sentidos:
 *   grilla → pila: se miden las tapas, se monta la pila encima (invisible),
 *     se arrancan las fundas en esos rectángulos y recién ahí se esconde la
 *     grilla, mientras el alto del contenedor va hacia el de la pila.
 *   pila → grilla: se monta la grilla invisible abajo de la pila, se miden sus
 *     tapas, las fundas vuelan hacia ahí, y al llegar aparece la grilla y se
 *     desmonta la pila.
 *
 * La vista va en la URL (`?vista=pila`) para poder compartirla y para que
 * volver atrás desde un disco te deje donde estabas.
 */
export default function Discography({ albums, ingesting, artistName }) {
  const [params, setParams] = useSearchParams()
  const startStack = params.get('vista') === 'pila'

  const [filter, setFilter] = useState('album')
  const [view, setView] = useState(startStack ? 'stack' : 'grid')
  const [phase, setPhase] = useState(null) // null | 'loading' | 'toStack' | 'toGrid'
  const [gridVisible, setGridVisible] = useState(!startStack)
  const [shelfVisible, setShelfVisible] = useState(startStack)
  const [wrapH, setWrapH] = useState(startStack ? shelfHeight() : null)
  const [boxH, setBoxH] = useState(shelfHeight)
  const [mode, setMode] = useState('browse')
  const [focus, setFocus] = useState(0)
  // El disco que está adelante mientras se recorre la pila (el elemento avisa
  // con `shelf-cursor`). `focus` es el que se abrió; pueden no coincidir.
  const [cursor, setCursor] = useState(0)
  // El tema resaltado, sea por el surco o por el renglón de la lista.
  const [hoverTrack, setHoverTrack] = useState(0)
  // El tema abierto: su info reemplaza al listado en la misma columna.
  const [openTrack, setOpenTrack] = useState(null)
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)

  const wrapRef = useRef(null)
  const shelfRef = useRef(null)
  const rectsRef = useRef([])

  const filtered = useMemo(() => albums.filter(a => a.album_type === filter), [albums, filter])
  const current = filtered[focus] || filtered[0]

  const showGrid = view === 'grid' || phase === 'toStack' || phase === 'toGrid'
  const showShelf = view === 'stack'
  const busy = phase !== null

  // Entrando directo con ?vista=pila no hay grilla desde donde volar.
  useEffect(() => { if (startStack) loadShelf() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // El alto de la pila sigue a la ventana (girar el teléfono, redimensionar).
  useEffect(() => {
    const onResize = () => {
      const h = shelfHeight()
      setBoxH(h)
      setMobile(window.innerWidth < 768)
      if (view === 'stack' && !busy) setWrapH(h)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [view, busy])

  // Cambiar de filtro con un disco abierto: el índice apuntaría a otro disco.
  useEffect(() => { setMode('browse'); setFocus(0); setCursor(0) }, [filter])

  const setVista = (vista) => {
    setParams(p => {
      const next = new URLSearchParams(p)
      if (vista) next.set('vista', vista)
      else next.delete('vista')
      return next
    }, { replace: true })
  }

  const toStack = async () => {
    if (view !== 'grid' || busy || !wrapRef.current) return
    rectsRef.current = measureCovers(wrapRef.current)
    setWrapH(wrapRef.current.offsetHeight)
    setPhase('loading')
    try {
      await loadShelf()
    } catch (err) {
      console.error('No se pudo cargar la pila 3D:', err)
      setPhase(null)
      setWrapH(null)
      return
    }
    setMode('browse')
    setFocus(0)
    setCursor(0)
    setView('stack')
    setPhase('toStack')
    setVista('pila')
  }

  const toGrid = () => {
    if (view !== 'stack' || busy) return
    setMode('browse')
    setPhase('toGrid')
    setVista(null)
  }

  /*
   * Los temas se piden recién al abrir un disco: es una consulta por disco, y
   * la ficha del disco los ingesta si todavía no están (de ahí el reintento).
   */
  const { data: albumData } = useQuery({
    queryKey: ['album', current?.id],
    queryFn: () => getAlbum(current.id),
    enabled: showShelf && !!current && mode !== 'browse',
    refetchInterval: (query) => (query.state.data?.ingestingTracks ? 1000 : false),
  })
  const tracks = useMemo(() => {
    if (!albumData || albumData.album?.id !== current?.id) return []
    return albumData.tracks || []
  }, [albumData, current])

  const albumsAttr = useMemo(
    () => JSON.stringify(filtered.map(a => ({ title: a.title, year: albumYear(a) || '', cover: a.cover_url || null }))),
    [filtered]
  )
  // `n` es la posición y no `track_number`: en un disco doble la numeración
  // vuelve a 1 y dos surcos con el mismo número se pisarían.
  const tracksAttr = useMemo(
    () => JSON.stringify(tracks.map((t, i) => ({ n: i + 1, title: t.title, dur: trackDuration(t) || '3:00' }))),
    [tracks]
  )

  // Atributos a mano: React no se los pasa bien a un custom element. Tiene que
  // ir antes que los efectos del pase, que usan las fundas ya armadas.
  useEffect(() => {
    const el = shelfRef.current
    if (!el) return
    el.setAttribute('albums', albumsAttr)
    el.setAttribute('tracks', tracksAttr)
    el.setAttribute('layout', 'stack')
    el.setAttribute('mode', mode)
    el.setAttribute('sel', String(focus))
    el.setAttribute('accent', '#c1592c')
    el.setAttribute('artist', artistName || '')
    el.setAttribute('zones', zonesFor(mobile))
  }, [albumsAttr, tracksAttr, mode, focus, artistName, showShelf, mobile])

  useEffect(() => {
    const el = shelfRef.current
    if (!el) return
    const onMode = e => {
      setMode(e.detail.mode)
      setFocus(e.detail.index)
      // Cerrar el disco o volver a la pila cierra también la canción abierta.
      if (e.detail.mode !== 'split') setOpenTrack(null)
    }
    // Un clic en un surco abre esa canción al costado, igual que el renglón.
    const onTrack = e => {
      const t = tracks[e.detail.n - 1]
      if (t) setOpenTrack(t.id)
    }
    const onCursor = e => setCursor(e.detail.index)
    const onHover = e => setHoverTrack(e.detail.n)
    el.addEventListener('shelf-mode', onMode)
    el.addEventListener('shelf-track', onTrack)
    el.addEventListener('shelf-cursor', onCursor)
    el.addEventListener('shelf-hover', onHover)
    return () => {
      el.removeEventListener('shelf-mode', onMode)
      el.removeEventListener('shelf-track', onTrack)
      el.removeEventListener('shelf-cursor', onCursor)
      el.removeEventListener('shelf-hover', onHover)
    }
  }, [tracks, showShelf])

  /* grilla → pila */
  useEffect(() => {
    if (phase !== 'toStack') return
    const el = shelfRef.current
    let alive = true
    const timers = []
    // Esperar las tapas: si no, las fundas saldrían con la tapa de relleno
    // encima de la imagen real que se estaba viendo. Están en caché del
    // navegador, así que casi siempre es inmediato.
    Promise.resolve(el?.coversReady?.()).then(() => {
      if (!alive) return
      el?.intro?.(rectsRef.current)
      setShelfVisible(true)
      setGridVisible(false)
      // Un frame después, para que el navegador vea el alto inicial y anime.
      requestAnimationFrame(() => setWrapH(shelfHeight()))
      timers.push(setTimeout(() => setPhase(null), MORPH_MS))
    })
    return () => {
      alive = false
      timers.forEach(clearTimeout)
    }
  }, [phase])

  /* pila → grilla */
  useLayoutEffect(() => {
    if (phase !== 'toGrid' || !wrapRef.current) return
    const wrap = wrapRef.current
    // La grilla ya está montada (invisible) abajo de la pila: se mide ahí.
    shelfRef.current?.outro?.(measureCovers(wrap))
    const gridEl = wrap.querySelector('[data-grid]')
    const target = gridEl ? gridEl.offsetHeight : 0
    const raf = requestAnimationFrame(() => setWrapH(target))
    const t1 = setTimeout(() => setGridVisible(true), MORPH_MS - 120)
    const t2 = setTimeout(() => {
      setView('grid')
      setShelfVisible(false)
      setWrapH(null)
      setPhase(null)
    }, MORPH_MS + 80)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [phase])

  // La canción abierta se busca en la lista del disco: si cambiaste de disco
  // o todavía no llegaron los temas, no hay nada que mostrar.
  const shownTrack = openTrack ? tracks.find(t => t.id === openTrack) : null

  const browsing = mode === 'browse'
  // Abajo va el disco de adelante mientras se recorre, y el abierto si hay uno.
  const shown = browsing ? filtered[cursor] || filtered[0] : current
  const year = albumYear(shown)
  const atFirst = cursor <= 0
  const atLast = cursor >= filtered.length - 1

  return (
    <section className="mb-16">
      <div className="flex items-baseline gap-4 flex-wrap mb-3">
        <h2 className="font-display text-3xl">Discografía</h2>
        <div className="flex gap-2.5 flex-wrap ml-auto">
          <div className="seg">
            {[
              { value: 'album', label: 'Álbumes' },
              { value: 'single', label: 'Sencillos y EP' },
            ].map(({ value, label }) => (
              <label key={value} className="seg-opt">
                <input
                  type="radio"
                  name="disco"
                  checked={filter === value}
                  onChange={() => setFilter(value)}
                  disabled={busy}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {filtered.length > 0 && !ingesting && (
            <div className="seg">
              {[
                { value: 'grid', label: 'Grilla', go: toGrid },
                { value: 'stack', label: 'Pila', go: toStack },
              ].map(({ value, label, go }) => (
                <label key={value} className="seg-opt">
                  <input
                    type="radio"
                    name="vista-disco"
                    checked={view === value}
                    onChange={go}
                    disabled={busy}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {ingesting ? (
        <SkeletonGrid count={5} min={168} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nada por acá">
          {filter === 'album'
            ? 'Esta banda todavía no tiene álbumes fichados.'
            : 'No hay sencillos ni EP cargados.'}
        </EmptyState>
      ) : (
        <div
          ref={wrapRef}
          className={`relative ${busy ? 'overflow-hidden' : ''}`}
          style={{
            height: wrapH ?? undefined,
            transition: busy ? `height ${MORPH_MS}ms cubic-bezier(.2,.85,.25,1)` : undefined,
          }}
        >
          {showGrid && (
            <div
              data-grid
              // Dos columnas fijas en el teléfono: con el mínimo de 168px caía a
              // una sola, cada tapa ocupaba la pantalla entera y el pase a la
              // pila no se notaba.
              className={`grid grid-cols-2 gap-x-4 gap-y-7
                          sm:gap-8 sm:[grid-template-columns:repeat(auto-fill,minmax(168px,1fr))]
                          transition-opacity duration-200 ${
                gridVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              aria-hidden={!gridVisible}
            >
              {filtered.map(a => <AlbumCard key={a.id} album={a} />)}
            </div>
          )}

          {showShelf && (
            <div
              className="absolute inset-x-0 top-0"
              style={{ height: boxH, visibility: shelfVisible ? 'visible' : 'hidden' }}
            >
              {/* Sin etiquetas sobre los surcos: con la lista al lado eran
                  ruido, y en pantallas chicas costaba apuntarles. */}
              <shelf-3d ref={shelfRef} style={{ position: 'absolute', inset: 0 }} />

              {/*
                La columna de canciones, apoyada sobre la zona que la escena 3D
                deja libre (ver ZONES). El hover va en los dos sentidos: por acá
                se ilumina el surco, y por el surco se ilumina el renglón.
              */}
              {mode === 'split' && (
                <div
                  className="absolute flex flex-col animate-fade-up"
                  style={{ ...(mobile ? ZONES.mobile.panel : ZONES.desktop.panel), position: 'absolute' }}
                  onMouseLeave={() => shelfRef.current?.setHover?.(0)}
                >
                  {shownTrack ? (
                    <TrackPanel
                      track={shownTrack}
                      artistName={artistName}
                      onBack={() => setOpenTrack(null)}
                    />
                  ) : (
                  <>
                  <div className="flex items-baseline gap-3 flex-wrap mb-2 pr-1">
                    <h3 className="font-display text-[19px] sm:text-2xl leading-tight line-clamp-2">
                      {current?.title}
                    </h3>
                    <ArrowLink to={`/album/${current?.id}`} className="ml-auto">Ver la ficha</ArrowLink>
                  </div>
                  <p className="kicker mb-3">
                    {[year, KIND[current?.album_type], tracks.length ? `${tracks.length} temas` : null]
                      .filter(Boolean).join(' · ')}
                  </p>

                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
                    {tracks.length === 0 ? (
                      albumData?.ingestingTracks || !albumData ? (
                        <SkeletonRows count={6} avatar={false} />
                      ) : (
                        <p className="text-[13.5px] text-gray-500">
                          Este disco todavía no tiene las canciones cargadas.
                        </p>
                      )
                    ) : (
                      tracks.map((t, i) => (
                        <TrackRow
                          key={t.id}
                          track={t}
                          index={i}
                          selected={hoverTrack === i + 1}
                          onHover={() => shelfRef.current?.setHover?.(i + 1)}
                          onOpen={() => setOpenTrack(t.id)}
                        />
                      ))
                    )}
                  </div>
                  </>
                  )}
                </div>
              )}

              <div className="absolute inset-0 pointer-events-none">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'split' ? 'focus' : 'browse')}
                  aria-label="Volver a la pila"
                  className={`btn btn-secondary btn-icon absolute top-3 left-0 transition-opacity duration-300 ${
                    browsing ? 'opacity-0' : 'opacity-100 pointer-events-auto'
                  }`}
                >
                  <IconArrowLeft size={18} />
                </button>

                {/*
                  Nombre y año del disco de adelante, con flechas para pasar de
                  a uno sin rueda — en touch o con trackpad es lo más cómodo.
                  Con un disco abierto las flechas se esconden (sin mover el
                  título) y aparece el link a la ficha.
                */}
                <div
                  // Con el vinilo afuera esto se va: el nombre del disco y el
                  // link a la ficha pasan a encabezar la lista de canciones.
                  className={`absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 text-center px-2 pb-4 pt-14
                              transition-opacity duration-300 ${
                    shelfVisible && mode !== 'split' ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ background: 'linear-gradient(to top, #100d0b 10%, rgba(16,13,11,0.85) 50%, rgba(16,13,11,0) 100%)' }}
                >
                  {/*
                    Las flechas no se mueven al pasar de disco: el centro tiene
                    ancho y alto fijos (título de hasta dos renglones, pegado al
                    año de abajo). Si siguieran al largo del título, el botón se
                    correría bajo el dedo a mitad de un recorrido.
                  */}
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-5 w-full max-w-[560px]">
                    <button
                      type="button"
                      onClick={() => shelfRef.current?.step?.(-1)}
                      disabled={atFirst}
                      aria-label="Disco anterior"
                      className={`btn btn-secondary btn-icon flex-none disabled:opacity-30 ${
                        browsing ? 'pointer-events-auto' : 'invisible'
                      }`}
                    >
                      <IconArrowLeft size={18} />
                    </button>

                    <div
                      key={shown?.id}
                      className="min-w-0 h-[78px] sm:h-[98px] flex flex-col justify-end animate-fade-up"
                      aria-live="polite"
                    >
                      <h3 className="font-display text-[clamp(21px,2.4vw,30px)] leading-[1.15] text-balance line-clamp-2">
                        {shown?.title}
                      </h3>
                      <p className="font-mono text-[12px] tracking-[0.14em] uppercase text-gray-500 mt-1.5">
                        {browsing
                          ? year || '—'
                          : [year, KIND[shown?.album_type]].filter(Boolean).join(' · ')}
                        {mode === 'split' && albumData?.ingestingTracks && ' · trayendo los temas…'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => shelfRef.current?.step?.(1)}
                      disabled={atLast}
                      aria-label="Disco siguiente"
                      className={`btn btn-secondary btn-icon flex-none disabled:opacity-30 ${
                        browsing ? 'pointer-events-auto' : 'invisible'
                      }`}
                    >
                      <IconArrowRight size={18} />
                    </button>
                  </div>
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
        </div>
      )}
    </section>
  )
}
