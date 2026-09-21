import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Índice lateral de años. Fijo mientras se scrollea la época, marca en qué año
 * está parado el lector y permite saltar entre años.
 */
export default function YearRail({ groups, activeLabel, onSelect }) {
  if (groups.length < 2) return null

  return (
    <nav className="hidden lg:block w-24 flex-shrink-0">
      <ul className="sticky top-24 space-y-1 border-l border-rock-border pl-3">
        {groups.map(group => {
          const active = group.label === activeLabel
          return (
            <li key={group.label}>
              <button
                onClick={() => onSelect(group.label)}
                className={`block w-full text-left text-sm py-0.5 transition-colors ${
                  active
                    ? 'text-rock-accent font-semibold'
                    : 'text-gray-500 hover:text-rock-text'
                }`}
              >
                {group.label}
                <span className="font-mono text-[11px] text-gray-500 ml-1.5">{group.entries.length}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Cuánto se queda el riel a la vista desde que arranca el scroll, en ms. */
const IDLE = 1400

/**
 * Sin eventos de scroll durante este tiempo, el scroll terminó y el próximo es
 * uno nuevo. Alcanza para cubrir la inercia del teléfono después de soltar el
 * dedo, que sigue disparando eventos: eso es el mismo gesto, no otro.
 */
const GESTURE_GAP = 400

/**
 * El mismo índice en el teléfono, donde no hay una columna libre al lado.
 *
 * Aparece sobre el margen izquierdo cuando arranca un scroll y se va al
 * segundo, se siga scrolleando o no. Así ir de 1972 a 1979 sigue siendo un
 * toque —antes eran veinte pantallas de scroll— sin que el índice ocupe
 * pantalla de forma permanente. Quedarse todo el scroll a la vista molestaba:
 * leyendo de corrido, tapaba el margen de cada portada que pasaba.
 *
 * Para volver a verlo alcanza con frenar y scrollear de nuevo: cada gesto
 * nuevo lo despierta una vez.
 *
 * Se ve igual que el de escritorio (la línea, el año, la cantidad), con un
 * sombra para que se lea encima de las portadas.
 *
 * Anclado desde arriba y no centrado: al frenar el scroll el navegador del
 * teléfono muestra u oculta su barra, el alto de la pantalla cambia y un riel
 * centrado pegaba un salto justo en ese momento. El borde de arriba no se mueve.
 *
 * Entra rápido y se va despacio: aparecer tiene que acompañar al dedo; irse de
 * golpe se sentía como un parpadeo.
 *
 * Tocarlo lo mantiene a la vista: si desapareciera con el dedo encima, elegir
 * un año sería una carrera contra el reloj.
 */
export function YearFloat({ groups, activeLabel, onSelect }) {
  const [awake, setAwake] = useState(false)
  const timer = useRef(null)
  const gestureEnd = useRef(null)
  const scrolling = useRef(false)

  const wake = () => {
    setAwake(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAwake(false), IDLE)
  }

  useEffect(() => {
    const onScroll = () => {
      // Sólo el primer evento de cada gesto lo muestra; los siguientes sólo
      // estiran el gesto, así el riel se va al segundo aunque se siga.
      if (!scrolling.current) {
        scrolling.current = true
        wake()
      }
      clearTimeout(gestureEnd.current)
      gestureEnd.current = setTimeout(() => { scrolling.current = false }, GESTURE_GAP)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(timer.current)
      clearTimeout(gestureEnd.current)
    }
  }, [])

  if (groups.length < 2) return null

  // Al `body` y no donde se declara: la página entra con `animate-fade-up`,
  // una animación de transform que queda "llenando", y eso convierte a su div
  // en el contenedor de todo lo `fixed` de adentro. Ahí el riel se ubicaba
  // contra la página entera y no contra la pantalla.
  const shown = awake ? 'opacity-100 duration-150' : 'opacity-0 duration-500'

  return createPortal(
    <>
      {/*
        La sombra no rodea a los años: baja por todo el borde izquierdo de la
        pantalla y se esfuma hacia la derecha. Una mancha del tamaño del riel,
        encima de una tapa clara, se leía como una suciedad; a lo alto de la
        pantalla se lee como luz. Sin desenfoque: sobre colores claros el blur
        mezclaba el negro con la tapa y quedaba gris verdoso.
      */}
      <span
        aria-hidden
        className={`lg:hidden fixed inset-y-0 left-0 w-36 z-30 pointer-events-none
                    bg-gradient-to-r from-black/75 via-black/40 to-transparent
                    transition-opacity ease-out ${shown}`}
      />
      <nav
        aria-label="Años"
        onPointerDown={wake}
        className={`lg:hidden fixed left-0 top-[140px] z-30 pl-4 pr-3
                    transition-opacity ease-out ${shown} ${awake ? '' : 'pointer-events-none'}`}
      >
      <ul
        className="max-h-[calc(100svh-260px)] overflow-y-auto no-scrollbar
                   space-y-1.5 border-l border-white/25 pl-3
                   [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]"
      >
        {groups.map(group => {
          const active = group.label === activeLabel
          return (
            <li key={group.label}>
              <button
                onClick={() => { onSelect(group.label); wake() }}
                aria-current={active ? 'location' : undefined}
                className={`block text-left text-[15px] py-0.5 transition-colors ${
                  active ? 'text-rock-accent font-semibold' : 'text-gray-200'
                }`}
              >
                {group.label}
                <span className="font-mono text-[11px] text-gray-400 ml-1.5">{group.entries.length}</span>
              </button>
            </li>
          )
        })}
      </ul>
      </nav>
    </>,
    document.body
  )
}
