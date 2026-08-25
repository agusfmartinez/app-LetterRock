/**
 * Línea de tiempo de la formación: una barra por músico sobre un eje de años.
 *
 * Es la lectura que la lista no da: quién se solapó con quién, cuánto duró cada
 * etapa y los huecos en que la banda no existió. En Sui Generis el vacío entre
 * 1975 y 2000 ocupa medio gráfico, y eso es exactamente lo que pasó.
 *
 * El eje es lineal a propósito. Comprimir los años sin nadie haría el gráfico
 * más compacto pero mentiría sobre las distancias, que es lo único que este
 * gráfico tiene para aportar.
 */
function yearTicks(from, to) {
  const span = to - from
  // Un tick cada 5 años en rangos cortos; cada 10 cuando la banda cruza décadas.
  const step = span > 40 ? 10 : 5
  const first = Math.ceil(from / step) * step
  const ticks = []
  for (let year = first; year <= to; year += step) ticks.push(year)
  return ticks
}

export default function MemberTimeline({ people }) {
  const drawable = people.filter(p => p.segments.length > 0)
  if (drawable.length === 0) return null

  const from = Math.min(...drawable.flatMap(p => p.segments.map(s => s.from)))
  const to = Math.max(...drawable.flatMap(p => p.segments.map(s => s.to)))
  const span = Math.max(1, to - from)

  // Cada año ocupa una fracción del ancho; el último también, para que un tramo
  // de un solo año se vea como un bloque y no como una línea.
  const left = (year) => ((year - from) / (span + 1)) * 100
  const width = (seg) => ((seg.to - seg.from + 1) / (span + 1)) * 100

  const ticks = yearTicks(from, to)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="flex">
          <div className="w-36 flex-shrink-0" />
          <div className="relative flex-1 h-5">
            {ticks.map(year => (
              <span
                key={year}
                style={{ left: `${left(year)}%` }}
                className="absolute text-[10px] text-gray-600 -translate-x-1/2"
              >
                {year}
              </span>
            ))}
          </div>
        </div>

        {drawable.map(person => (
          <div key={person.key} className="flex items-center group">
            <div className="w-36 flex-shrink-0 pr-3 text-right">
              <span className="text-xs text-gray-400 group-hover:text-rock-text truncate block">
                {person.name}
              </span>
            </div>

            <div className="relative flex-1 h-5">
              {/* Guías de año, para poder leer dónde cae cada barra. */}
              {ticks.map(year => (
                <span
                  key={year}
                  style={{ left: `${left(year)}%` }}
                  className="absolute inset-y-0 w-px bg-rock-border"
                />
              ))}

              {person.segments.map((seg, i) => (
                <span
                  key={i}
                  style={{ left: `${left(seg.from)}%`, width: `${width(seg)}%` }}
                  title={`${person.name}: ${seg.from === seg.to ? seg.from : `${seg.from}–${seg.to}`}`}
                  className={`absolute top-1 bottom-1 rounded-sm ${
                    person.isOriginal ? 'bg-rock-accent' : 'bg-gray-600 group-hover:bg-gray-500'
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
