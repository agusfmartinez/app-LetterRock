import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabaseClient'

export const MIN_FAVORITE_ARTISTS = 3

export type ArtistOption = { id: string; name: string; image_url: string | null }

/**
 * Bandas para elegir en el onboarding.
 *
 * Sin `term` trae una muestra —las últimas cargadas, mismo criterio que "Bandas
 * en la comunidad" en Home— para que la pantalla no arranque vacía. No se
 * llama "populares": no hay ninguna métrica real detrás todavía, y prometer
 * una que no existe es peor que no prometer nada.
 *
 * Sólo busca en el catálogo local, nunca en la API externa: acá se favorean
 * bandas que ya tienen fila en `artists`, no que se podrían ingestar.
 */
export function useOnboardingArtists(term: string) {
  const query = term.trim()

  return useQuery({
    queryKey: ['onboarding-artists', query],
    queryFn: async (): Promise<ArtistOption[]> => {
      let request = supabase
        .from('artists')
        .select('id, name, image_url')
        .eq('hidden', false)
        .order('created_at', { ascending: false })
        .limit(30)

      if (query) request = request.ilike('name', `%${query}%`)

      const { data } = await request
      return data || []
    },
  })
}

/**
 * Guarda de una vez todas las bandas elegidas como favoritas.
 *
 * `ignoreDuplicates` porque no importa si alguna ya estaba —no debería pasar en
 * un alta recién creada, pero no cuesta nada ser tolerante— y porque sin eso
 * cualquier choque tira abajo el insert entero en vez de guardar el resto.
 */
export function useSaveOnboardingFavorites() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, artistIds }: { userId: string; artistIds: string[] }) => {
      if (artistIds.length === 0) return
      const { error } = await supabase
        .from('favorites')
        .upsert(
          artistIds.map(id => ({ user_id: userId, entity_type: 'artist', entity_id: id })),
          { onConflict: 'user_id,entity_type,entity_id', ignoreDuplicates: true }
        )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-favorites'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
    },
  })
}

export type SuggestedUser = {
  id: string
  username: string
  avatar_url: string | null
  bio: string | null
  shared_count: number
}

/**
 * Gente afín, a partir de las bandas favoritas de la sesión.
 *
 * La afinidad la calcula `suggested_users` en la base (ver 019): cuenta
 * coincidencias de favoritos entre usuarios, que es un GROUP BY que PostgREST
 * no arma solo. Acá sólo se resuelven los perfiles de los ids que devuelve.
 */
export function useSuggestedUsers(enabled: boolean) {
  return useQuery({
    queryKey: ['suggested-users'],
    queryFn: async (): Promise<SuggestedUser[]> => {
      const { data: matches, error } = await supabase.rpc('suggested_users', { p_limit: 10 })
      if (error) throw error
      if (!matches || matches.length === 0) return []

      const { data: profiles } = await supabase
        .from('users')
        .select('id, username, avatar_url, bio')
        .in('id', matches.map((m: any) => m.user_id))

      const byId = new Map((profiles || []).map((p: any) => [p.id, p]))
      // El orden de `matches` es por afinidad; el de `profiles` no está
      // garantizado, así que se reconstruye a mano en vez de confiar en el que
      // vuelva de la segunda consulta.
      return matches
        .map((m: any) => {
          const profile = byId.get(m.user_id)
          return profile ? { ...profile, shared_count: m.shared_count } : null
        })
        .filter(Boolean) as SuggestedUser[]
    },
    enabled,
  })
}
