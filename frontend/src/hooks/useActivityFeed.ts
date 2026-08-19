import { useQuery } from '@tanstack/react-query'
import { fetchEntities, type EntityType } from '../services/entities'
import { supabase } from '../services/supabaseClient'

export type ActivityKind = 'review' | 'favorite' | 'comment'

export type Activity = {
  id: string
  kind: ActivityKind
  created_at: string
  user: { username: string; avatar_url: string | null } | null
  entity_type: EntityType
  entity_id: string
  entity: any | null
  rating?: number
  text?: string | null
}

const USER_SELECT = 'user:users(username, avatar_url)'

/**
 * Feed global: últimas reviews, favoritos y comentarios de toda la comunidad,
 * mezclados por fecha. Global y no de follows porque todavía no hay red de usuarios.
 */
export function useActivityFeed(limit = 20) {
  return useQuery({
    queryKey: ['activity-feed', limit],
    queryFn: async (): Promise<Activity[]> => {
      const [reviews, favorites, comments] = await Promise.all([
        supabase
          .from('reviews')
          .select(`id, user_id, entity_type, entity_id, rating, text, created_at, ${USER_SELECT}`)
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('favorites')
          .select(`id, user_id, entity_type, entity_id, created_at, ${USER_SELECT}`)
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('comments')
          .select(`id, user_id, entity_type, entity_id, body, created_at, ${USER_SELECT}`)
          .order('created_at', { ascending: false })
          .limit(limit),
      ])

      const events: Activity[] = [
        ...(reviews.data || []).map((r: any) => ({ ...r, kind: 'review' as const })),
        ...(favorites.data || []).map((f: any) => ({ ...f, kind: 'favorite' as const })),
        ...(comments.data || []).map((c: any) => ({ ...c, kind: 'comment' as const, text: c.body })),
      ]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit)

      const byId = await fetchEntities(events)
      return events.map(e => ({ ...e, entity: byId.get(e.entity_id) || null }))
    },
    staleTime: 60 * 1000,
  })
}
