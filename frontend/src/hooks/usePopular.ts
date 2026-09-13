import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabaseClient'

type EntityType = 'artist' | 'album' | 'track' | 'collection' | 'collection_section'

/**
 * Los ids más guardados en favoritos de un tipo, de mayor a menor.
 *
 * "Popular" acá quiere decir eso y nada más: cuánta gente lo guardó. No es el
 * promedio de puntajes — con tres votos el promedio lo gana cualquiera — ni lo
 * último agregado, que es otra cosa y ya tenía su lugar.
 *
 * Se cuenta en el cliente porque la comunidad es chica y trae unas pocas filas.
 * Cuando `favorites` crezca, esto tiene que pasar a una vista o una función en
 * la base que devuelva el conteo ya agrupado: bajar todas las filas para
 * sumarlas acá deja de escalar mucho antes de que se note en pantalla.
 */
export function usePopularIds(entityType: EntityType, limit = 12) {
  return useQuery({
    queryKey: ['popular-ids', entityType, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorites')
        .select('entity_id')
        .eq('entity_type', entityType)
      if (error) throw error

      const counts = new Map<string, number>()
      for (const row of data || []) {
        counts.set(row.entity_id, (counts.get(row.entity_id) || 0) + 1)
      }

      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id, count]) => ({ id, count }))
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Las bandas más guardadas.
 *
 * Si todavía hay pocas con favoritos, completa con las últimas en entrar al
 * archivo: una grilla de dos artistas en la home parece rota, y los que
 * completan también son una buena puerta de entrada.
 */
export function usePopularArtists(limit = 12) {
  const popular = usePopularIds('artist', limit)

  return useQuery({
    queryKey: ['popular-artists', limit, popular.data],
    enabled: popular.isSuccess || popular.isError,
    queryFn: async () => {
      const ranked = popular.data || []
      const ids = ranked.map(r => r.id)

      let top: any[] = []
      if (ids.length > 0) {
        const { data, error } = await supabase
          .from('artists')
          .select('*')
          .in('id', ids)
          .eq('hidden', false)
        if (error) throw error
        // `in` no respeta el orden de la lista: se reordena por el conteo.
        const order = new Map(ids.map((id, i) => [id, i]))
        top = (data || []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      }

      if (top.length >= limit) return top

      let fill = supabase
        .from('artists')
        .select('*')
        .eq('hidden', false)
        .order('created_at', { ascending: false })
        .limit(limit - top.length)
      if (top.length > 0) fill = fill.not('id', 'in', `(${top.map(a => a.id).join(',')})`)

      const { data: rest, error } = await fill
      if (error) throw error
      return [...top, ...(rest || [])]
    },
  })
}
