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
 * Últimas reviews, favoritos y comentarios, mezclados por fecha.
 *
 * Con `userIds` queda restringido a esas personas —el feed de a quiénes seguís—
 * y sin él muestra a toda la comunidad. Un array vacío no es lo mismo que no
 * pasar nada: significa "seguís a cero personas", y ahí el feed es vacío de
 * verdad, no global.
 */
export function useActivityFeed(limit = 20, userIds?: string[]) {
  return useQuery({
    queryKey: ['activity-feed', limit, userIds ? [...userIds].sort() : null],
    queryFn: async (): Promise<Activity[]> => {
      if (userIds && userIds.length === 0) return []

      const scope = <T>(query: T): T =>
        userIds ? ((query as any).in('user_id', userIds) as T) : query

      const [reviews, favorites, comments] = await Promise.all([
        scope(
          supabase
            .from('reviews')
            .select(`id, user_id, entity_type, entity_id, rating, text, created_at, ${USER_SELECT}`)
            .order('created_at', { ascending: false })
            .limit(limit)
        ),
        scope(
          supabase
            .from('favorites')
            .select(`id, user_id, entity_type, entity_id, created_at, ${USER_SELECT}`)
            .order('created_at', { ascending: false })
            .limit(limit)
        ),
        scope(
          supabase
            .from('comments')
            .select(`id, user_id, entity_type, entity_id, body, created_at, ${USER_SELECT}`)
            .order('created_at', { ascending: false })
            .limit(limit)
        ),
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
