import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabaseClient'

export type TopTrack = {
  id: string
  title: string
  album_id: string
  track_number: number | null
  play_count: number
  url: string | null
}

/**
 * Temas más escuchados de cada álbum, según las reproducciones de YouTube.
 *
 * Va en dos consultas y se cruza en memoria: `media_links` es polimórfica
 * (`entity_type` + `entity_id`, sin FK), así que PostgREST no puede embeberla
 * dentro de `tracks`. Dos queries para toda la sección igual sale más barato
 * que una por álbum.
 */
export function useTopTracksByAlbum(albumIds: string[], limit = 4) {
  const key = [...albumIds].sort().join(',')

  return useQuery({
    queryKey: ['top-tracks', key, limit],
    queryFn: async (): Promise<Record<string, TopTrack[]>> => {
      const { data: tracks } = await supabase
        .from('tracks')
        .select('id, title, album_id, track_number')
        .in('album_id', albumIds)

      const trackIds = (tracks || []).map(t => t.id)
      if (trackIds.length === 0) return {}

      const { data: links } = await supabase
        .from('media_links')
        .select('entity_id, play_count, url')
        .eq('entity_type', 'track')
        .eq('provider', 'youtube')
        .in('entity_id', trackIds)

      const byTrack = new Map((links || []).map(l => [l.entity_id, l]))
      const grouped: Record<string, TopTrack[]> = {}

      for (const track of tracks || []) {
        const link = byTrack.get(track.id)
        if (!link || link.play_count == null) continue
        if (!grouped[track.album_id]) grouped[track.album_id] = []
        grouped[track.album_id].push({
          ...(track as any),
          play_count: Number(link.play_count),
          url: link.url,
        })
      }

      for (const albumId of Object.keys(grouped)) {
        grouped[albumId] = grouped[albumId]
          .sort((a, b) => b.play_count - a.play_count)
          .slice(0, limit)
      }

      return grouped
    },
    enabled: albumIds.length > 0,
  })
}

const FORMATTER = new Intl.NumberFormat('es-AR')
const COMPACT = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })

export function formatPlayCount(count: number): string {
  return FORMATTER.format(count)
}

/** Versión corta para filas de tracklist: 13,3 M en vez de 13.317.396. */
export function formatPlayCountCompact(count: number): string {
  return COMPACT.format(count)
}
