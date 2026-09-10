/*
 * Los tres estados que la app muestra más seguido de lo que uno quisiera:
 * cargando, vacío y roto. Definidos una vez acá; cada pantalla toma el que le
 * toca. El orden siempre es isLoading → error → empty → data.
 */

/* — 1 · Cargando —
 * El esqueleto tiene la forma de lo que está por aparecer, para que la página
 * no salte cuando llega. Nunca un "Cargando…" suelto ni un spinner en el medio
 * de la nada.
 */

/** Anchos irregulares: renglones todos iguales se leen como una tabla, no como texto. */
const LINE_WIDTHS = ['62%', '88%', '45%', '74%', '55%']

/** Ficha: bloque cuadrado + renglones. Detalle de banda, disco o perfil. */
export function SkeletonFicha({ lines = 4 }) {
  return (
    <div className="flex gap-6 flex-wrap" aria-hidden="true">
      <span className="skeleton w-28 h-28 flex-none rounded-xl" />
      <div className="flex-1 min-w-[150px] flex flex-col gap-2.5 pt-1">
        {Array.from({ length: lines }).map((_, i) => (
          <span
            key={i}
            className="skeleton h-3 rounded-full"
            style={{ width: LINE_WIDTHS[i % LINE_WIDTHS.length] }}
          />
        ))}
      </div>
    </div>
  )
}

/** Grilla: N tarjetas iguales. Colecciones, resultados, discografías. */
export function SkeletonGrid({ count = 6, min = 150 }) {
  return (
    <div
      className="grid gap-5"
      style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${min}px,1fr))` }}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2.5">
          <span className="skeleton aspect-square rounded-xl" />
          <span
            className="skeleton h-3 rounded-full"
            style={{ width: LINE_WIDTHS[i % LINE_WIDTHS.length] }}
          />
        </div>
      ))}
    </div>
  )
}

/** Filas: renglones de alto uniforme. Tracklist, actividad, gente, tablas. */
export function SkeletonRows({ count = 5, avatar = true }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5">
          {avatar && <span className="skeleton w-10 h-10 flex-none rounded-full" />}
          <div className="flex-1 flex flex-col gap-2">
            <span
              className="skeleton h-3 rounded-full"
              style={{ width: LINE_WIDTHS[i % LINE_WIDTHS.length] }}
            />
            <span
              className="skeleton h-2.5 rounded-full"
              style={{ width: LINE_WIDTHS[(i + 2) % LINE_WIDTHS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/*
 * Panel: en el admin no vale la pena imitar la forma exacta — tres barras
 * alcanzan. Quien entra al panel ya sabe qué está esperando.
 */
export function SkeletonPanel({ lines = 3 }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <span
          key={i}
          className="skeleton h-3 rounded-full"
          style={{ width: LINE_WIDTHS[i % LINE_WIDTHS.length] }}
        />
      ))}
    </div>
  )
}

/* — 2 · Vacío —
 * Una frase que explique por qué está vacío y, si existe, la salida. Sin
 * ilustraciones grandes ni signos de admiración: el vacío no es un error.
 */
export function EmptyState({ title, children, action }) {
  return (
    <div className="py-10">
      {title && (
        <p className="font-display text-xl text-rock-text mb-2">{title}</p>
      )}
      {children && (
        <p className="text-sm text-gray-400 leading-relaxed max-w-prose">{children}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* — 3 · Error —
 * La terracota del sistema hace de alerta: no hay rojo en la paleta y no lo
 * vamos a inventar. Siempre dos cosas: qué pasó, y qué puede hacer quien lo
 * lee. Nunca un alert() ni un toast que se va solo.
 */
export function ErrorState({ title = 'No pudimos cargar esto.', children, onRetry }) {
  return (
    <div
      role="alert"
      className="flex gap-4 items-start flex-wrap bg-rock-accent/10 border border-rock-accentDim rounded-xl p-6"
    >
      <span className="w-8 h-8 flex-none rounded-full bg-rock-accent text-rock-dark grid place-items-center text-lg font-bold">
        !
      </span>
      <div className="flex-1 min-w-[220px]">
        <p className="text-base text-rock-text mb-1.5 leading-snug">{title}</p>
        <p className="text-sm text-gray-400 leading-relaxed">
          {children || 'Puede ser la conexión. Si sigue pasando, avisanos a soporte@letterrock.app.'}
        </p>
        {onRetry && (
          <button className="btn btn-primary mt-4" onClick={onRetry}>
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}

/*
 * Para "esto no está" alcanza una línea, sin caja: la pantalla completa de 404
 * es sólo para rutas que no existen.
 */
export function NotFoundLine({ children }) {
  return <p className="py-10 text-base text-rock-accentBright">{children}</p>
}
