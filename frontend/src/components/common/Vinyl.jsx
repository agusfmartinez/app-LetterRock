import { useEffect, useRef } from 'react'
import { trackDuration } from '../../services/dates'

/*
 * El vinilo 3D. El dibujo lo hace `vinyl3d.js`, que es un custom element
 * (`<vinyl-3d>`) con three.js adentro: se importa por efecto — al cargarse se
 * registra solo en `customElements` — y desde acá sólo se le pasan atributos.
 *
 * React no sabe escribir atributos en un custom element de forma confiable
 * (los pasaría como propiedades), así que se escriben a mano con
 * `setAttribute` sobre el ref. Los eventos, por lo mismo, se enganchan con
 * `addEventListener` y no con props `onX`.
 */

/** El formato que espera el elemento: "1|La rubia tarada|3:02;2|Kaya|4:12" */
function toTracksAttr(tracks) {
  return tracks
    .map((t, i) => {
      // Los separadores no se escapan del otro lado, así que se limpian acá.
      const title = (t.title || '').replace(/[|;]/g, ' ').trim()
      return `${t.track_number ?? i + 1}|${title}|${trackDuration(t) || '3:00'}`
    })
    .join(';')
}

export default function Vinyl({ tracks = [], album, activeTrack, onSelect, onHover, height = 520 }) {
  const ref = useRef(null)

  /* La carga es diferida: three pesa, y sólo hace falta en esta pantalla. */
  useEffect(() => {
    let alive = true
    import('./vinyl3d.js').catch(err => {
      if (alive) console.error('No se pudo cargar el vinilo 3D:', err)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const select = e => onSelect?.(e.detail.n)
    const hover = e => onHover?.(e.detail.n)
    el.addEventListener('vinyl-select', select)
    el.addEventListener('vinyl-hover', hover)
    return () => {
      el.removeEventListener('vinyl-select', select)
      el.removeEventListener('vinyl-hover', hover)
    }
  }, [onSelect, onHover])

  /* Los surcos se generan por la duración real de cada track: cambiar la lista
     obliga a redibujar la textura, y eso lo dispara el atributo. */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.setAttribute('tracks', toTracksAttr(tracks))
    el.setAttribute('accent', '#c1592c')
    el.setAttribute('label-title', album?.title || '')
    el.setAttribute('label-artist', album?.artist?.name || album?.artist_name || '')
    el.setAttribute('label-year', album?.release_date?.slice(0, 4) || '')
  }, [tracks, album])

  useEffect(() => {
    ref.current?.setAttribute('active', String(activeTrack ?? 0))
  }, [activeTrack])

  if (tracks.length === 0) return null

  return (
    <vinyl-3d
      ref={ref}
      style={{ display: 'block', width: '100%', height }}
      aria-hidden="true"
    />
  )
}
