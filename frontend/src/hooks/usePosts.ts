import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchEntities, type EntityType } from '../services/entities'
import { supabase } from '../services/supabaseClient'

export type Post = {
  id: string
  user_id: string
  body: string
  entity_type: EntityType | null
  entity_id: string | null
  hidden: boolean
  created_at: string
  user?: { username: string; avatar_url: string | null } | null
  entity?: any | null
}

export const POST_MAX = 500

const POST_SELECT =
  'id, user_id, body, entity_type, entity_id, hidden, created_at, user:users(username, avatar_url)'

/**
 * Le cuelga a cada posteo la banda, disco o colección que menciona.
 *
 * Los que no adjuntan nada quedan afuera de la consulta: `fetchEntities` espera
 * referencias completas, y un posteo sin adjunto no tiene nada que resolver.
 */
async function withEntities(posts: any[]): Promise<Post[]> {
  const refs = posts.filter(p => p.entity_type && p.entity_id)
  const byId = refs.length > 0 ? await fetchEntities(refs) : new Map()
  return posts.map(p => ({ ...p, entity: p.entity_id ? byId.get(p.entity_id) || null : null }))
}

/** Los posteos de una persona, para su perfil. */
export function useUserPosts(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-posts', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      return withEntities(data || [])
    },
    enabled: !!userId,
  })
}

function useInvalidatePosts() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of ['activity-feed', 'user-posts']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
}

export function usePostMutations() {
  const invalidate = useInvalidatePosts()
  const opts = { onSuccess: invalidate }

  return {
    createPost: useMutation({
      mutationFn: async (values: {
        user_id: string
        body: string
        entity_type?: EntityType | null
        entity_id?: string | null
      }) => {
        const { data, error } = await supabase
          .from('posts')
          .insert({
            user_id: values.user_id,
            body: values.body,
            // Van de a dos o ninguno: la base lo exige con un CHECK.
            entity_type: values.entity_id ? values.entity_type : null,
            entity_id: values.entity_id || null,
          })
          .select()
          .single()
        if (error) throw error
        return data
      },
      ...opts,
    }),

    deletePost: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('posts').delete().eq('id', id)
        if (error) throw error
      },
      ...opts,
    }),

    /** Moderación: bajar sin borrar. El trigger de la base sólo se lo permite a un editor. */
    setPostHidden: useMutation({
      mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
        const { error } = await supabase.from('posts').update({ hidden }).eq('id', id)
        if (error) throw error
      },
      ...opts,
    }),
  }
}

export type CatalogHit = { entity_type: EntityType; entity_id: string; label: string; sub: string | null }

/**
 * Buscador para adjuntar algo a un posteo.
 *
 * Busca en el catálogo local y no en la API externa como el buscador de bandas:
 * se adjunta algo que ya existe en LetterRock y tiene página propia. Traer un
 * disco de MusicBrainz al vuelo desde el composer sería ingestar sin querer.
 */
export function useCatalogSearch(query: string) {
  const term = query.trim()

  return useQuery({
    queryKey: ['catalog-search', term],
    queryFn: async (): Promise<CatalogHit[]> => {
      const like = `%${term}%`
      const [artists, albums, tracks] = await Promise.all([
        supabase.from('artists').select('id, name').eq('hidden', false).ilike('name', like).limit(4),
        supabase
          .from('albums')
          .select('id, title, artist:artists(name)')
          .eq('hidden', false)
          .ilike('title', like)
          .limit(4),
        supabase
          .from('tracks')
          .select('id, title, album:albums(title, artist:artists(name))')
          .ilike('title', like)
          .limit(4),
      ])

      return [
        ...(tracks.data || []).map((t: any) => ({
          entity_type: 'track' as const,
          entity_id: t.id,
          label: t.title,
          sub: t.album?.artist?.name || t.album?.title || null,
        })),
        ...(albums.data || []).map((a: any) => ({
          entity_type: 'album' as const,
          entity_id: a.id,
          label: a.title,
          sub: a.artist?.name || null,
        })),
        ...(artists.data || []).map((a: any) => ({
          entity_type: 'artist' as const,
          entity_id: a.id,
          label: a.name,
          sub: null,
        })),
      ]
    },
    // Con una o dos letras entran cientos de resultados que nadie lee.
    enabled: term.length >= 2,
  })
}
