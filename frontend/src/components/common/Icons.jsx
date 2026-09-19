/*
 * Los iconos de la app. Trazo 2.75 como en las maquetas — más fino se pierde
 * sobre el fondo oscuro. Van inline y no como librería: son doce, y una
 * dependencia por doce paths no se paga.
 *
 * Todos toman el color del texto (`currentColor`) y el tamaño por prop, así
 * que se alinean solos con lo que los rodea.
 */

function Svg({ size = 20, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconHome = (p) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V21h13V9.5" />
  </Svg>
)

export const IconDisc = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.5" />
  </Svg>
)

export const IconLayers = (p) => (
  <Svg {...p}>
    <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
    <path d="M3 12.5 12 17l9-4.5" />
    <path d="M3 17.5 12 22l9-4.5" />
  </Svg>
)

export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </Svg>
)

export const IconUser = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" />
  </Svg>
)

export const IconUsers = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c1-3.2 3.4-4.8 6.5-4.8s5.5 1.6 6.5 4.8" />
    <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6" />
    <path d="M18 15.5c2 .7 3.3 2.2 4 4.5" />
  </Svg>
)

export const IconStar = ({ filled = false, ...p }) => (
  <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.2-5.4-2.9-5.4 2.9 1-6.2L3.2 10l6.1-.9L12 3.5Z" />
  </Svg>
)

export const IconHeart = ({ filled = false, ...p }) => (
  <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20.5S3.5 15.2 3.5 9.4A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 8.5 3.4c0 5.8-8.5 11.1-8.5 11.1Z" />
  </Svg>
)

export const IconArrowLeft = (p) => (
  <Svg {...p}>
    <line x1="20" y1="12" x2="4" y2="12" />
    <polyline points="10,6 4,12 10,18" />
  </Svg>
)

export const IconChevronRight = (p) => (
  <Svg {...p}>
    <polyline points="9,5 16,12 9,19" />
  </Svg>
)

export const IconArrowRight = (p) => (
  <Svg {...p}>
    <line x1="4" y1="12" x2="20" y2="12" />
    <polyline points="14,6 20,12 14,18" />
  </Svg>
)

/** Sale del sitio: la flecha en diagonal de "abre en otra pestaña". */
export const IconExternal = (p) => (
  <Svg {...p}>
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="9,7 17,7 17,15" />
  </Svg>
)

export const IconPlus = (p) => (
  <Svg {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
)

export const IconCheck = (p) => (
  <Svg {...p}>
    <polyline points="4,12.5 9.5,18 20,6" />
  </Svg>
)

export const IconX = (p) => (
  <Svg {...p}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </Svg>
)

export const IconMenu = (p) => (
  <Svg {...p}>
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </Svg>
)

/* "Más acciones": los tres puntos de un menú. Rellenos: con trazo quedan
   como tres rayitas. */
export const IconMore = ({ size = 20, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
    <circle cx="5.5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="18.5" cy="12" r="1.9" />
  </svg>
)

/* Discografía en grilla: cuatro tapas. */
export const IconGrid = (p) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Svg>
)

/* Discografía en pila: una funda adelante y los bordes de las de atrás. */
export const IconStack = (p) => (
  <Svg {...p}>
    <rect x="5" y="9" width="14" height="11" rx="2" />
    <path d="M7 5.5h10" />
    <path d="M6 7.5h12" />
  </Svg>
)

/*
 * Marcas de las plataformas. Van rellenas y no de trazo: son logos, no iconos
 * de la app, y con trazo fino no se reconocen. Toman el color del texto, así
 * que el verde y el rojo los pone el botón.
 */
export const IconSpotify = ({ size = 20, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.586 14.424a.623.623 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 1 1-.277-1.215c3.809-.871 7.077-.496 9.713 1.115a.623.623 0 0 1 .206.857Zm1.223-2.722a.78.78 0 0 1-1.072.256c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 1 1-.453-1.492c3.632-1.102 8.147-.568 11.234 1.329a.78.78 0 0 1 .256 1.073Zm.106-2.835c-3.223-1.914-8.54-2.09-11.591-1.164a.935.935 0 1 1-.542-1.79c3.502-1.063 9.373-.858 13.073 1.338a.935.935 0 1 1-.94 1.616Z" />
  </svg>
)

export const IconYouTubeMusic = ({ size = 20, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...rest}>
    <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.9" />
    <path d="M10.1 8.15 16 12l-5.9 3.85V8.15Z" fill="currentColor" />
  </svg>
)

/*
 * El vinilo de la marca. No es un icono de trazo: es un disco, y se dibuja
 * con gradientes para que tenga surcos de verdad. `spin` lo hace girar — se
 * usa sólo en el hero, en el header queda quieto.
 */
export function VinylMark({ size = 26, spin = false }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block flex-none rounded-full ${spin ? 'animate-spin-slow' : ''}`}
      style={{
        width: size,
        height: size,
        background: `
          radial-gradient(circle at 50% 50%, #100d0b 0 10%, transparent 11%),
          radial-gradient(circle at 50% 50%, #c1592c 11% 34%, transparent 35%),
          repeating-radial-gradient(circle at 50% 50%, #241d18 0 1.5px, #100d0b 1.5px 3px)
        `,
      }}
    />
  )
}
