import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'

/**
 * Seguir usuarios.
 *
 * En `follows`, `user_id` es el seguido y `follower_id` el que sigue. Las
 * policies exigen que `follower_id` sea el de la sesión, así que nadie puede
 * hacer que otro siga a alguien; el SELECT es público, y por eso los contadores
 * se ven sin estar logueado.
 */

const USER_SELECT = 'id, username, avatar_url, bio'

/** Seguidores y seguidos de un perfil, más si la sesión lo sigue. */
export function useFollow(userId: string | undefined) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['follows', userId],
    queryFn: async () => {
      // Las dos direcciones en un pedido cada una: son dos índices distintos y
      // PostgREST no puede traer ambas en una sola consulta.
      const [followers, following] = await Promise.all([
        supabase.from('follows').select('follower_id').eq('user_id', userId),
        supabase.from('follows').select('user_id').eq('follower_id', userId),
      ])
      return {
        followerIds: (followers.data || []).map(r => r.follower_id as string),
        followingIds: (following.data || []).map(r => r.user_id as string),
      }
    },
    enabled: !!userId,
  })

  const followerIds = data?.followerIds || []
  const followingIds = data?.followingIds || []
  const isFollowing = !!user && followerIds.includes(user.id)
  const isSelf = !!user && user.id === userId

  const { mutate: toggle, isPending } = useMutation({
    mutationFn: async () => {
      if (!user || !userId) throw new Error('No autenticado')
      // Seguirse a uno mismo no lo impide la base: es una regla de producto, no
      // de integridad, y el botón directamente no se muestra en el perfil propio.
      if (user.id === userId) throw new Error('No podés seguirte a vos mismo')

      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('user_id', userId)
          .eq('follower_id', user.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ user_id: userId, follower_id: user.id })
        if (error) throw error
      }
    },
    onSuccess: () => {
      // El perfil de los dos cambia de contador, y el feed de Home puede estar
      // filtrado justo por a quién sigue esta sesión.
      queryClient.invalidateQueries({ queryKey: ['follows'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
    },
  })

  return {
    followerIds,
    followingIds,
    followerCount: followerIds.length,
    followingCount: followingIds.length,
    isFollowing,
    isSelf,
    toggle,
    isPending,
  }
}

/**
 * Los perfiles de una lista de ids, para las pestañas de seguidores y seguidos.
 *
 * Se resuelve aparte y no como join embebido porque `follows` tiene dos claves
 * foráneas a `users` y PostgREST no sabe cuál de las dos querés sin que se lo
 * digas por el nombre del constraint.
 */
export function useUserProfiles(ids: string[]) {
  const key = [...new Set(ids)].sort()

  return useQuery({
    queryKey: ['user-profiles', key],
    queryFn: async () => {
      if (key.length === 0) return []
      const { data } = await supabase.from('users').select(USER_SELECT).in('id', key)
      return data || []
    },
    enabled: key.length > 0,
  })
}

/** A quiénes sigue la sesión actual. Alimenta el filtro del feed de Home. */
export function useMyFollowing() {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: ['follows', 'mine', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('user_id')
        .eq('follower_id', user!.id)
      return (data || []).map(r => r.user_id as string)
    },
    enabled: !!user?.id,
  })
}
