import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'

export type EntityType = 'artist' | 'album' | 'track'

/**
 * Favoritos de una entidad. Devuelve si el usuario actual la marcó y el total.
 * El SELECT de favorites es público (ver RLS), así que el contador funciona sin sesión.
 */
export function useFavorite(entityType: EntityType, entityId: string | undefined) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['favorites', entityType, entityId],
    queryFn: async () => {
      const { data } = await supabase
        .from('favorites')
        .select('user_id')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
      return (data || []) as { user_id: string }[]
    },
    enabled: !!entityId,
  })

  const isFavorite = !!user && rows.some(r => r.user_id === user.id)

  const { mutate: toggle, isPending } = useMutation({
    mutationFn: async () => {
      if (!user || !entityId) throw new Error('No autenticado')

      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, entity_type: entityType, entity_id: entityId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', entityType, entityId] })
      queryClient.invalidateQueries({ queryKey: ['user-favorites'] })
    },
  })

  return {
    isFavorite,
    count: rows.length,
    toggle,
    isPending,
    isLoading,
    canFavorite: !!user,
  }
}

type FavoriteRow = {
  id: string
  entity_type: EntityType
  entity_id: string
  created_at: string
  entity: any | null
}

/** Favoritos de un usuario, con la entidad resuelta (artista / álbum / canción). */
export function useUserFavorites(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-favorites', userId],
    queryFn: async (): Promise<FavoriteRow[]> => {
      const { data: favorites } = await supabase
        .from('favorites')
        .select('id, entity_type, entity_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      const rows = (favorites || []) as Omit<FavoriteRow, 'entity'>[]
      if (rows.length === 0) return []

      const idsOf = (type: EntityType) =>
        rows.filter(r => r.entity_type === type).map(r => r.entity_id)

      const [artists, albums, tracks] = await Promise.all([
        idsOf('artist').length
          ? supabase.from('artists').select('id, name, slug, image_url, formed_year').in('id', idsOf('artist'))
          : Promise.resolve({ data: [] }),
        idsOf('album').length
          ? supabase.from('albums').select('id, title, cover_url, release_date, album_type').in('id', idsOf('album'))
          : Promise.resolve({ data: [] }),
        idsOf('track').length
          ? supabase.from('tracks').select('id, title, duration_ms, album:albums(id, title, cover_url)').in('id', idsOf('track'))
          : Promise.resolve({ data: [] }),
      ])

      const byId = new Map<string, any>()
      for (const list of [artists.data, albums.data, tracks.data]) {
        for (const item of list || []) byId.set((item as any).id, item)
      }

      return rows.map(r => ({ ...r, entity: byId.get(r.entity_id) || null }))
    },
    enabled: !!userId,
  })
}
