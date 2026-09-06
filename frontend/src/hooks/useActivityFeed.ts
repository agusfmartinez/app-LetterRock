import { useQuery } from '@tanstack/react-query'
import { fetchEntities, type EntityType } from '../services/entities'
import { supabase } from '../services/supabaseClient'

export type ActivityKind = 'review' | 'favorite' | 'comment' | 'post'

export type Activity = {
  id: string
  kind: ActivityKind
  created_at: string
  user: { username: string; avatar_url: string | null } | null
  /** Nulos sólo en un posteo suelto: es el único evento que puede no ser sobre algo. */
  entity_type: EntityType | null
  entity_id: string | null
  entity: any | null
  rating?: number
  text?: string | null
  user_id?: string
  hidden?: boolean
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

      const [reviews, favorites, comments, posts] = await Promise.all([
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
        // Los ocultos no se filtran acá: RLS ya se los muestra sólo a su autor y
        // a los editores, y repetir la regla sería una segunda copia que puede
        // quedar desincronizada de la de la base.
        scope(
          supabase
            .from('posts')
            .select(`id, user_id, entity_type, entity_id, body, hidden, created_at, ${USER_SELECT}`)
            .order('created_at', { ascending: false })
            .limit(limit)
        ),
      ])

      const events: Activity[] = [
        ...(reviews.data || []).map((r: any) => ({ ...r, kind: 'review' as const })),
        ...(favorites.data || []).map((f: any) => ({ ...f, kind: 'favorite' as const })),
        ...(comments.data || []).map((c: any) => ({ ...c, kind: 'comment' as const, text: c.body })),
        ...(posts.data || []).map((p: any) => ({ ...p, kind: 'post' as const, text: p.body })),
      ]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit)

      // Un posteo puede no colgar de nada, y `fetchEntities` espera referencias
      // completas: se le pasan sólo los eventos que tienen a qué apuntar.
      const byId = await fetchEntities(events.filter(e => e.entity_type && e.entity_id) as any)
      return events.map(e => ({ ...e, entity: e.entity_id ? byId.get(e.entity_id) || null : null }))
    },
    staleTime: 60 * 1000,
  })
}
