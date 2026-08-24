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
    for (const key of ['collections', 'collection', 'collection-section', 'album-search']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
}

/**
 * Traduce los errores de Postgres que el editor puede provocar. Sin esto la UI
 * muestra el nombre del índice violado, que no le dice nada a quien edita.
 */
export function describeError(error: any): string {
  if (!error) return ''

  if (error.code === '23505') {
    if (String(error.message).includes('idx_collection_entries_unique_album')) {
      return 'Ese disco ya está cargado en esta sección.'
    }
    if (String(error.message).includes('collection_sections_slug')) {
      return 'Ya existe una sección con ese nombre en la colección.'
    }
    if (String(error.message).includes('collections_slug')) {
      return 'Ya existe una colección con ese nombre.'
    }
    return 'Ese registro ya existe.'
  }

  if (error.code === '42501') {
    return 'No tenés permisos para hacer este cambio.'
  }

  return error.message || 'No se pudo completar la operación.'
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

export type AlbumFilters = {
  title: string
  artist: string
  yearFrom: string
  yearTo: string
  studioOnly: boolean
}

export const EMPTY_ALBUM_FILTERS: AlbumFilters = {
  title: '',
  artist: '',
  yearFrom: '',
  yearTo: '',
  studioOnly: true,
}

/**
 * Búsqueda de álbumes para cargar en una sección. No corre sola: el editor
 * arma los filtros y dispara la consulta, así la pantalla no arranca con
 * cientos de discos que nadie pidió.
 *
 * Los álbumes ya cargados en la sección se descartan del resultado.
 */
export function useAlbumSearch(section: any, filters: AlbumFilters, enabled: boolean) {
  return useQuery({
    queryKey: ['album-search', section?.id, filters],
    queryFn: async () => {
      const { data: existing } = await supabase
        .from('collection_entries')
        .select('album_id')
        .eq('section_id', section.id)
      const taken = new Set((existing || []).map((e: any) => e.album_id).filter(Boolean))

      // El filtro por banda se resuelve en dos pasos y no como filtro sobre la
      // relación embebida: así el descarte pasa sobre `albums` mismo.
      let artistIds: string[] | null = null
      if (filters.artist.trim()) {
        const { data: artists } = await supabase
          .from('artists')
          .select('id')
          .ilike('name', `%${filters.artist.trim()}%`)
        artistIds = (artists || []).map((a: any) => a.id)
        if (artistIds.length === 0) return []
      }

      let query = supabase
        .from('albums')
        .select('id, title, cover_url, release_date, release_date_precision, album_type, artist:artists(id, name, slug)')
        .order('release_date', { ascending: true })
        .limit(100)

      if (filters.title.trim()) query = query.ilike('title', `%${filters.title.trim()}%`)
      if (artistIds) query = query.in('artist_id', artistIds)
      if (filters.studioOnly) query = query.eq('album_type', 'album')
      if (filters.yearFrom) query = query.gte('release_date', `${filters.yearFrom}-01-01`)
      if (filters.yearTo) query = query.lte('release_date', `${filters.yearTo}-12-31`)

      const { data, error } = await query
      if (error) throw error
      return (data || []).filter((a: any) => !taken.has(a.id))
    },
    enabled: enabled && !!section?.id,
  })
}
