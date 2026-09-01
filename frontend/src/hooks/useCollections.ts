import { useQuery } from '@tanstack/react-query'
import { entrySortKey, entryYear } from '../services/dates'
import { supabase } from '../services/supabaseClient'

const ENTRY_SELECT = `
  id, entry_type, title, body_text, year, rank, position, section_id, image_url,
  album:albums(id, title, cover_url, release_date, release_date_precision, album_type,
               description, external_spotify_id, artist:artists(id, name, slug)),
  artist:artists(id, name, slug, image_url, formed_year)
`

/**
 * Orden dentro de una sección: por año, después por `position`, después por fecha.
 *
 * Los años nunca se mezclan. Dentro de uno manda `position`, que arranca en 0
 * para todos —o sea, no desempata— y entonces cae al orden cronológico fino: el
 * disco de marzo antes que el de septiembre.
 *
 * Ese 0 es el que hace que el año siga siendo automático. Cuando el editor
 * mueve algo, la reordenación escribe 1..n en *todas* las entradas de ese año, y
 * a partir de ahí ese año queda como lo dejó. Es lo que permite intercalar un
 * bloque de texto entre dos discos: por fecha sola no hay forma, porque un
 * bloque sólo tiene año y siempre caería antes que un disco con fecha completa.
 */
export function sortEntries(entries: any[]): any[] {
  return [...entries].sort((a, b) => {
    const ya = entryYear(a) ?? 9999
    const yb = entryYear(b) ?? 9999
    if (ya !== yb) return ya - yb

    const pa = a.position || 0
    const pb = b.position || 0
    if (pa !== pb) return pa - pb

    const ka = entrySortKey(a)
    const kb = entrySortKey(b)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
}

/**
 * Posición para una entrada nueva en un año ya ordenado a mano.
 *
 * Sin esto, entrar con `position` 0 la mandaría al principio del año pisando el
 * orden que el editor eligió. En un año que nadie tocó devuelve 0 y todo sigue
 * saliendo por fecha.
 */
export function nextPositionInYear(entries: any[], year: number | null): number {
  const positions = entries
    .filter(e => (entryYear(e) ?? null) === year)
    .map(e => e.position || 0)

  const max = Math.max(0, ...positions)
  return max > 0 ? max + 1 : 0
}

export type YearGroup = { year: number | null; label: string; entries: any[] }

/**
 * Agrupa las entries por año conservando el orden cronológico.
 * Es la unidad de lectura de la timeline: un año, los discos que salieron.
 */
export function groupEntriesByYear(entries: any[]): YearGroup[] {
  const groups: YearGroup[] = []

  for (const entry of sortEntries(entries)) {
    const year = entryYear(entry)
    const last = groups[groups.length - 1]
    if (last && last.year === year) {
      last.entries.push(entry)
    } else {
      groups.push({ year, label: year ? String(year) : 'Sin año', entries: [entry] })
    }
  }
  return groups
}

/**
 * Las colecciones de un usuario, para su perfil.
 *
 * No filtra por publicada ni por oculta: eso ya lo hace RLS, que le muestra al
 * dueño sus borradores y a los demás sólo lo publicado. Repetir la regla acá
 * sería una segunda copia que puede quedar desincronizada de la de la base.
 */
export function useUserCollections(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-collections', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('collections')
        .select('*, author:users(username, avatar_url)')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      const list = data || []
      if (list.length === 0) return []

      const { data: sections } = await supabase
        .from('collection_sections')
        .select('collection_id')
        .in('collection_id', list.map(c => c.id))

      const counts = new Map<string, number>()
      for (const s of sections || []) {
        counts.set(s.collection_id, (counts.get(s.collection_id) || 0) + 1)
      }
      return list.map(c => ({ ...c, section_count: counts.get(c.id) || 0 }))
    },
    enabled: !!userId,
  })
}

/**
 * Orden de una colección sin épocas.
 *
 * En un ranking manda el puesto y los que todavía no lo tienen van al final:
 * un `rank` vacío es "sin puesto asignado", no "puesto cero". En una lista el
 * orden lo pone el editor con `position`, y ahí la fecha del disco no importa
 * —justamente esa es la diferencia con una timeline—.
 */
export function sortFlatEntries(entries: any[], type: string): any[] {
  return [...entries].sort((a, b) => {
    if (type === 'ranking') {
      const ra = a.rank ?? Infinity
      const rb = b.rank ?? Infinity
      if (ra !== rb) return ra - rb
    }
    const pa = a.position || 0
    const pb = b.position || 0
    if (pa !== pb) return pa - pb
    return String(a.created_at).localeCompare(String(b.created_at))
  })
}

/**
 * Una colección con lo que corresponda según su tipo.
 *
 * Una timeline se lee por épocas, así que trae sus secciones y cuántas entradas
 * tiene cada una. Una lista o un ranking no tienen épocas: se leen de corrido,
 * y ahí lo que hace falta son las entradas completas.
 *
 * Las entradas se piden por `collection_id` y no por "sin sección": las listas
 * y rankings que se armaron antes de que existiera esta distinción tienen sus
 * discos colgando de una sección, y filtrarlos los dejaría vacíos.
 */
export function useCollection(slug: string | undefined) {
  return useQuery({
    queryKey: ['collection', slug],
    queryFn: async () => {
      const { data: collection } = await supabase
        .from('collections')
        .select('*, author:users(username, avatar_url)')
        .eq('slug', slug)
        .single()

      if (!collection) return null

      const isTimeline = collection.type === 'timeline'

      const [{ data: sections }, { data: entries }] = await Promise.all([
        supabase
          .from('collection_sections')
          .select('*')
          .eq('collection_id', collection.id)
          .order('position', { ascending: true }),
        supabase
          .from('collection_entries')
          .select(isTimeline ? 'id, section_id' : `${ENTRY_SELECT}, created_at`)
          .eq('collection_id', collection.id),
      ])

      const counts = new Map<string, number>()
      for (const e of entries || []) {
        counts.set((e as any).section_id, (counts.get((e as any).section_id) || 0) + 1)
      }

      return {
        collection,
        sections: (sections || []).map(s => ({ ...s, entry_count: counts.get(s.id) || 0 })),
        entries: isTimeline ? [] : sortFlatEntries(entries || [], collection.type),
      }
    },
    enabled: !!slug,
  })
}

/** Una sección (una década) con sus entries ya ordenadas. */
export function useCollectionSection(slug: string | undefined, sectionSlug: string | undefined) {
  return useQuery({
    queryKey: ['collection-section', slug, sectionSlug],
    queryFn: async () => {
      const { data: collection } = await supabase
        .from('collections')
        .select('*, author:users(username, avatar_url)')
        .eq('slug', slug)
        .single()

      if (!collection) return null

      const { data: sections } = await supabase
        .from('collection_sections')
        .select('*')
        .eq('collection_id', collection.id)
        .order('position', { ascending: true })

      const all = sections || []
      const index = all.findIndex(s => s.slug === sectionSlug)
      const section = index >= 0 ? all[index] : null
      if (!section) return { collection, section: null, entries: [], prev: null, next: null }

      const { data: entries } = await supabase
        .from('collection_entries')
        .select(ENTRY_SELECT)
        .eq('section_id', section.id)

      return {
        collection,
        section,
        entries: sortEntries(entries || []),
        prev: index > 0 ? all[index - 1] : null,
        next: index < all.length - 1 ? all[index + 1] : null,
      }
    },
    enabled: !!slug && !!sectionSlug,
  })
}

/**
 * Todas las colecciones publicadas (los editores ven también los borradores).
 *
 * Quién ve qué lo decide RLS (`is_published OR is_editor()`), no esta consulta:
 * filtrar acá además sería una segunda regla que puede quedar desincronizada de
 * la de la base.
 *
 * Trae de paso cuántas secciones tiene cada una, en una sola consulta más. Es
 * lo que la portada de la colección necesita para no prometer una timeline
 * vacía.
 */
export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      // Quién la armó: en el índice conviven las de la app y las de la
      // comunidad, y sin el autor no hay forma de distinguir una de otra más
      // allá del bloque en el que caen.
      const { data } = await supabase
        .from('collections')
        .select('*, author:users(username, avatar_url)')
        .order('is_official', { ascending: false })
        .order('created_at', { ascending: false })

      const list = data || []
      if (list.length === 0) return []

      const { data: sections } = await supabase
        .from('collection_sections')
        .select('collection_id')
        .in('collection_id', list.map(c => c.id))

      const counts = new Map<string, number>()
      for (const s of sections || []) {
        counts.set(s.collection_id, (counts.get(s.collection_id) || 0) + 1)
      }

      return list.map(c => ({ ...c, section_count: counts.get(c.id) || 0 }))
    },
  })
}
