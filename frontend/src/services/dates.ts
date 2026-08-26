const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/**
 * Las fechas se parsean a mano y no con `new Date(...)`: 'YYYY-MM-DD' se
 * interpreta como UTC y en Argentina (UTC-3) un disco del 1 de enero pasaría
 * al 31 de diciembre del año anterior.
 */
export function parseDateParts(raw: string | null | undefined) {
  if (!raw) return null
  const [year, month, day] = raw.split('-').map(Number)
  if (!year) return null
  return { year, month: month || null, day: day || null }
}

export function albumYear(album: any): number | null {
  return parseDateParts(album?.release_date)?.year ?? null
}

/**
 * Precisión real de la fecha de un álbum.
 *
 * Los álbumes ingestados antes de guardar `release_date_precision` la tienen en
 * NULL, pero la fecha misma la delata: la ingesta sólo escribe día 1 cuando no
 * conoce el día, y mes 1 cuando no conoce el mes. Entonces un 1975-05-07 es
 * necesariamente día exacto. En los casos ambiguos se redondea hacia abajo, así
 * nunca se afirma un día que no está en el dato.
 */
export function effectivePrecision(album: any): 'year' | 'month' | 'day' | null {
  const stored = album?.release_date_precision
  if (stored === 'year' || stored === 'month' || stored === 'day') return stored

  const parts = parseDateParts(album?.release_date)
  if (!parts) return null
  if (parts.day && parts.day !== 1) return 'day'
  if (parts.month && parts.month !== 1) return 'month'
  return 'year'
}

/** Fecha de edición legible según lo que Spotify realmente sabe. */
export function formatReleaseDate(album: any): string | null {
  const parts = parseDateParts(album?.release_date)
  if (!parts) return null

  const precision = effectivePrecision(album)

  if (precision === 'day' && parts.month && parts.day) {
    return `${parts.day} de ${MONTHS[parts.month - 1]} de ${parts.year}`
  }
  if (precision === 'month' && parts.month) {
    return `${MONTHS[parts.month - 1]} de ${parts.year}`
  }
  return String(parts.year)
}

/** Clave de orden cronológico. Los bloques sin mes abren el año. */
export function entrySortKey(entry: any): string {
  const raw = entry.album?.release_date
  if (raw) return raw
  if (entry.year) return `${entry.year}-00-00`
  return '9999-99-99' // sin fecha → al final
}

export function entryYear(entry: any): number | null {
  return albumYear(entry.album) ?? entry.year ?? null
}

const RELATIVE = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
]

/**
 * "hace 3 días", "hace 2 meses", "recién".
 *
 * Para las marcas de última corrida de las ingestas, donde lo que importa es si
 * fue hoy o hace medio año, no el minuto exacto. La fecha completa queda en el
 * `title` de quien lo use.
 */
export function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null
  const elapsed = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(elapsed)) return null
  if (elapsed < 60 * 1000) return 'recién'

  for (const [unit, ms] of UNITS) {
    if (elapsed >= ms) return RELATIVE.format(-Math.round(elapsed / ms), unit)
  }
  return 'recién'
}
