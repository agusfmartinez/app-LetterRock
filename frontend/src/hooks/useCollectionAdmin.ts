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

    /**
     * Saca las entradas de sus épocas y borra las épocas vacías.
     *
     * Para las listas y rankings que se cargaron cuando el único editor era el
     * de sección: sus discos quedaron colgando de una época que ya no significa
     * nada. Primero se despega la entrada y recién después se borra la sección,
     * porque `section_id` cascadea: borrarla con entradas adentro se las lleva
     * puestas.
     */
    flattenCollection: useMutation({
      mutationFn: async (collectionId: string) => {
        await run(
          supabase
            .from('collection_entries')
            .update({ section_id: null })
            .eq('collection_id', collectionId)
        )
        await run(
          supabase.from('collection_sections').delete().eq('collection_id', collectionId)
        )
      },
      ...opts,
    }),

    /**
     * Numera un ranking de 1 a N en el orden en que vienen las entradas.
     *
     * El puesto no se guarda como lo escribe el editor: se guarda la secuencia
     * completa. Si alguien manda el segundo al séptimo lugar, los del medio
     * suben uno; si escribe un número más grande que la cantidad de discos,
     * queda último. Así no hay huecos ni dos discos en el mismo puesto, que es
     * lo único que un ranking no puede permitirse.
     */
    setRanks: useMutation({
      mutationFn: async (entries: any[]) => {
        for (let i = 0; i < entries.length; i++) {
          if (entries[i].rank === i + 1) continue // ya está en su lugar
          await run(
            supabase.from('collection_entries').update({ rank: i + 1 }).eq('id', entries[i].id)
          )
        }
      },
      ...opts,
    }),

    /**
     * Fija el orden de las entradas de un año, en el orden en que vienen.
     *
     * Escribe 1..n y no 0..n-1 a propósito: el 0 es la marca de "este año nunca
     * se tocó" y sigue significando orden cronológico automático.
     *
     * Van de a una en vez de un `upsert` en lote porque el upsert de PostgREST
     * es un INSERT ... ON CONFLICT y exigiría mandar todas las columnas NOT NULL
     * de la fila. Un año tiene unas pocas entradas.
     */
    reorderEntries: useMutation({
      mutationFn: async (entries: any[]) => {
        for (let i = 0; i < entries.length; i++) {
          await run(
            supabase.from('collection_entries').update({ position: i + 1 }).eq('id', entries[i].id)
          )
        }
      },
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
 * Búsqueda de álbumes para cargar. No corre sola: el editor arma los filtros y
 * dispara la consulta, así la pantalla no arranca con cientos de discos que
 * nadie pidió. Los que ya están cargados se descartan del resultado.
 *
 * `scope` es la sección cuando la colección tiene épocas, y la colección entera
 * cuando no (una lista o un ranking cargan sus discos sin sección). Lo único que
 * cambia es contra qué se pregunta "esto ya está cargado".
 */
export function useAlbumSearch(
  scope: { sectionId?: string | null; collectionId?: string | null },
  filters: AlbumFilters,
  enabled: boolean
) {
  const { sectionId = null, collectionId = null } = scope || {}

  return useQuery({
    queryKey: ['album-search', sectionId, collectionId, filters],
    queryFn: async () => {
      const takenQuery = supabase.from('collection_entries').select('album_id')
      const { data: existing } = await (sectionId
        ? takenQuery.eq('section_id', sectionId)
        : takenQuery.eq('collection_id', collectionId))
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
        .eq('hidden', false)
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
    enabled: enabled && (!!sectionId || !!collectionId),
  })
}
