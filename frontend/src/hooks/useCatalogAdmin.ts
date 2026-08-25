import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { describeError } from './useCollectionAdmin'
import { supabase } from '../services/supabaseClient'

export { describeError }

type Table = 'artists' | 'albums' | 'tracks'

/**
 * Campos que la ingesta reescribe en cada corrida y que, por lo tanto,
 * hay que marcar como manuales cuando el admin los edita.
 *
 * El resto (por ejemplo `description`, que Spotify no conoce) no necesita
 * protección: nadie los va a pisar.
 */
const INGESTED_FIELDS: Record<Table, string[]> = {
  artists: ['name', 'country', 'formed_year', 'artist_type', 'image_url', 'bio'],
  albums: ['title', 'release_date', 'release_date_precision', 'album_type', 'cover_url'],
  tracks: ['title', 'duration_ms', 'track_number', 'disc_number'],
}

function nextManualFields(table: Table, current: string[] | null, patch: Record<string, any>) {
  const protectedNow = new Set(current || [])
  for (const key of Object.keys(patch)) {
    if (INGESTED_FIELDS[table].includes(key)) protectedNow.add(key)
  }
  return [...protectedNow]
}

function useInvalidateCatalog() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of [
      'admin-artists', 'admin-artists-hidden-count', 'admin-artist',
      'admin-album', 'artist', 'album', 'collection-section',
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
}

/**
 * Guarda una fila del catálogo marcando qué campos quedaron editados a mano,
 * para que la próxima ingesta no los reescriba.
 */
export function useCatalogUpdate(table: Table) {
  const invalidate = useInvalidateCatalog()

  return useMutation({
    mutationFn: async ({ id, manual_fields, ...patch }: any) => {
      const { error } = await supabase
        .from(table)
        .update({
          ...patch,
          manual_fields: nextManualFields(table, manual_fields, patch),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/** Devuelve un campo al valor de la ingesta: deja de estar protegido. */
export function useReleaseManualField(table: Table) {
  const invalidate = useInvalidateCatalog()

  return useMutation({
    mutationFn: async ({ id, manual_fields, field }: any) => {
      const { error } = await supabase
        .from(table)
        .update({ manual_fields: (manual_fields || []).filter((f: string) => f !== field) })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/**
 * Alta manual de un disco. Sin `external_spotify_id`, así que la ingesta nunca
 * lo va a tocar: es un registro que sólo existe acá.
 */
export function useCreateAlbum() {
  const invalidate = useInvalidateCatalog()

  return useMutation({
    mutationFn: async (values: any) => {
      const { data, error } = await supabase
        .from('albums')
        .insert(values)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })
}

/** Alta manual de una canción, para discos que no vienen de Spotify. */
export function useCreateTrack() {
  const invalidate = useInvalidateCatalog()

  return useMutation({
    mutationFn: async (values: any) => {
      const { data, error } = await supabase
        .from('tracks')
        .insert(values)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })
}

/** Borra una canción. Sólo para admins: la policy de DELETE exige is_admin(). */
export function useDeleteTrack() {
  const invalidate = useInvalidateCatalog()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tracks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/**
 * Oculta o vuelve a mostrar una fila.
 *
 * Es la alternativa a borrar: la ingesta recrea por upsert todo lo que se borre,
 * así que la marca tiene que quedar en la base.
 */
export function useToggleHidden(table: 'artists' | 'albums') {
  const invalidate = useInvalidateCatalog()

  return useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const { error } = await supabase.from(table).update({ hidden }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/**
 * Listado de artistas para el panel, con búsqueda por nombre.
 * Los ocultos viven en su propia pantalla para no ensuciar el catálogo.
 */
export function useAdminArtists(search: string, hidden = false) {
  const term = search.trim()

  return useQuery({
    queryKey: ['admin-artists', term, hidden],
    queryFn: async () => {
      let query = supabase
        .from('artists')
        .select('id, name, slug, image_url, country, formed_year, manual_fields, hidden')
        .eq('hidden', hidden)
        .order('name', { ascending: true })
        .limit(100)

      if (term) query = query.ilike('name', `%${term}%`)

      const { data } = await query
      return data || []
    },
  })
}

/** Cuántos artistas hay ocultos, para el acceso desde el catálogo. */
export function useHiddenArtistCount() {
  return useQuery({
    queryKey: ['admin-artists-hidden-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('artists')
        .select('id', { count: 'exact', head: true })
        .eq('hidden', true)
      return count || 0
    },
  })
}

/** Un artista con sus álbumes, para la pantalla de edición. */
export function useAdminArtist(id: string | undefined) {
  return useQuery({
    queryKey: ['admin-artist', id],
    queryFn: async () => {
      const { data: artist } = await supabase
        .from('artists')
        .select('*')
        .eq('id', id)
        .single()

      if (!artist) return null

      const { data: albums } = await supabase
        .from('albums')
        .select('id, title, release_date, release_date_precision, album_type, cover_url, manual_fields, hidden')
        .eq('artist_id', id)
        .order('release_date', { ascending: true })

      return { artist, albums: albums || [] }
    },
    enabled: !!id,
  })
}

/** Un álbum con sus tracks, para la pantalla de edición. */
export function useAdminAlbum(id: string | undefined) {
  return useQuery({
    queryKey: ['admin-album', id],
    queryFn: async () => {
      const { data: album } = await supabase
        .from('albums')
        .select('*, artist:artists(id, name, slug)')
        .eq('id', id)
        .single()

      if (!album) return null

      const { data: tracks } = await supabase
        .from('tracks')
        .select('id, title, track_number, disc_number, duration_ms, manual_fields')
        .eq('album_id', id)
        .order('track_number', { ascending: true })

      return { album, tracks: tracks || [] }
    },
    enabled: !!id,
  })
}
