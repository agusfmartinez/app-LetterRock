import { useQuery } from '@tanstack/react-query'
import { entrySortKey, entryYear } from '../services/dates'
import { supabase } from '../services/supabaseClient'

const ENTRY_SELECT = `
  id, entry_type, title, body_text, year, rank, source, position, section_id, image_url,
  album:albums(id, title, cover_url, release_date, release_date_precision, album_type,
               description, external_spotify_id, artist:artists(id, name, slug)),
  artist:artists(id, name, slug, image_url, formed_year)
`

/**
 * Orden dentro de una sección: cronológico ascendente, `position` como desempate.
 * Así el editor no carga números a mano salvo que quiera forzar una excepción.
 */
export function sortEntries(entries: any[]): any[] {
  return [...entries].sort((a, b) => {
    const ka = entrySortKey(a)
    const kb = entrySortKey(b)
    if (ka !== kb) return ka < kb ? -1 : 1
    return a.position - b.position
  })
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

/** Colección + sus secciones + cuántas entries tiene cada una. */
export function useCollection(slug: string | undefined) {
  return useQuery({
    queryKey: ['collection', slug],
    queryFn: async () => {
      const { data: collection } = await supabase
        .from('collections')
        .select('*')
        .eq('slug', slug)
        .single()

      if (!collection) return null

      const [{ data: sections }, { data: entries }] = await Promise.all([
        supabase
          .from('collection_sections')
          .select('*')
          .eq('collection_id', collection.id)
          .order('position', { ascending: true }),
        supabase
          .from('collection_entries')
          .select('id, section_id')
          .eq('collection_id', collection.id),
      ])

      const counts = new Map<string, number>()
      for (const e of entries || []) {
        counts.set(e.section_id, (counts.get(e.section_id) || 0) + 1)
      }

      return {
        collection,
        sections: (sections || []).map(s => ({ ...s, entry_count: counts.get(s.id) || 0 })),
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
        .select('*')
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

/** Todas las colecciones publicadas (los editores ven también los borradores). */
export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const { data } = await supabase
        .from('collections')
        .select('*')
        .order('created_at', { ascending: true })
      return data || []
    },
  })
}
