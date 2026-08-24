import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabaseClient'

/** "Los 70" → "los-70". Sin acentos ni signos, para usar en la URL. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function useInvalidateCollections() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of ['collections', 'collection', 'collection-section', 'album-suggestions']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
}

async function run<T>(query: any): Promise<T> {
  const { data, error } = await query
  if (error) throw error
  return data as T
}

/**
 * CRUD de colecciones, secciones y entries.
 * Quien autoriza de verdad es RLS (`is_editor()`); la UI sólo esconde los botones.
 */
export function useCollectionAdmin() {
  const invalidate = useInvalidateCollections()
  const opts = { onSuccess: invalidate }

  return {
    createCollection: useMutation({
      mutationFn: (values: any) =>
        run(supabase.from('collections').insert({ ...values, slug: values.slug || slugify(values.title) }).select().single()),
      ...opts,
    }),
    updateCollection: useMutation({
      mutationFn: ({ id, ...patch }: any) => run(supabase.from('collections').update(patch).eq('id', id)),
      ...opts,
    }),
    deleteCollection: useMutation({
      mutationFn: (id: string) => run(supabase.from('collections').delete().eq('id', id)),
      ...opts,
    }),

    createSection: useMutation({
      mutationFn: (values: any) =>
        run(supabase.from('collection_sections').insert({ ...values, slug: values.slug || slugify(values.title) }).select().single()),
      ...opts,
    }),
    updateSection: useMutation({
      mutationFn: ({ id, ...patch }: any) => run(supabase.from('collection_sections').update(patch).eq('id', id)),
      ...opts,
    }),
    deleteSection: useMutation({
      mutationFn: (id: string) => run(supabase.from('collection_sections').delete().eq('id', id)),
      ...opts,
    }),

    createEntry: useMutation({
      mutationFn: (values: any) => run(supabase.from('collection_entries').insert(values).select().single()),
      ...opts,
    }),
    updateEntry: useMutation({
      mutationFn: ({ id, ...patch }: any) => run(supabase.from('collection_entries').update(patch).eq('id', id)),
      ...opts,
    }),
    deleteEntry: useMutation({
      mutationFn: (id: string) => run(supabase.from('collection_entries').delete().eq('id', id)),
      ...opts,
    }),
  }
}

/**
 * Álbumes de la DB que caen en el rango de años de la sección y todavía no
 * están cargados. Es la lista desde la que el editor elige con un clic.
 */
export function useAlbumSuggestions(section: any, search: string) {
  const term = search.trim()

  return useQuery({
    queryKey: ['album-suggestions', section?.id, term],
    queryFn: async () => {
      const { data: existing } = await supabase
        .from('collection_entries')
        .select('album_id')
        .eq('section_id', section.id)
      const taken = new Set((existing || []).map((e: any) => e.album_id).filter(Boolean))

      let query = supabase
        .from('albums')
        .select('id, title, cover_url, release_date, album_type, artist:artists(id, name, slug)')
        .order('release_date', { ascending: true })
        .limit(100)

      if (term) {
        query = query.ilike('title', `%${term}%`)
      } else {
        // Sin búsqueda: sólo álbumes de estudio del rango, para no llenar de singles.
        query = query.eq('album_type', 'album')
        if (section.year_from && section.year_to) {
          query = query
            .gte('release_date', `${section.year_from}-01-01`)
            .lte('release_date', `${section.year_to}-12-31`)
        }
      }

      const { data } = await query
      return (data || []).filter((a: any) => !taken.has(a.id))
    },
    enabled: !!section?.id,
  })
}
