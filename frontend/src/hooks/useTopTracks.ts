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

export type RankedTrack = TopTrack & { spotifyId: string | null; youtubeId: string | null }

export type AlbumMedia = {
  /** Temas ordenados por reproducciones, para el bloque de destacados. */
  top: RankedTrack[]
  /**
   * Los mismos, sin cortar. `top` está recortado para que el bloque de
   * destacados no muestre veinte filas, pero buscar el video de un tema suelto
   * —una entrada de canción, o la playlist derivada— tiene que poder mirar el
   * álbum entero: el tema puede no estar entre los más escuchados.
   */
  all: RankedTrack[]
  /** El más escuchado, en las dos plataformas: es lo que suena en la timeline. */
  feature: { spotifyId: string | null; youtubeId: string | null } | null
}

/**
 * Datos de YouTube de cada álbum: ranking de temas y videos para el reproductor.
 *
 * Va en dos consultas y se cruza en memoria: `media_links` es polimórfica
 * (`entity_type` + `entity_id`, sin FK), así que PostgREST no puede embeberla
 * dentro de `tracks`. Dos queries para toda la sección igual sale más barato
 * que una por álbum.
 */
export function useAlbumMedia(albumIds: string[], topLimit = 4) {
  const key = [...albumIds].sort().join(',')

  return useQuery({
    queryKey: ['album-media', key, topLimit],
    queryFn: async (): Promise<Record<string, AlbumMedia>> => {
      const { data: tracks } = await supabase
        .from('tracks')
        .select('id, title, album_id, track_number')
        .in('album_id', albumIds)
        .order('track_number', { ascending: true })

      const trackIds = (tracks || []).map(t => t.id)
      if (trackIds.length === 0) return {}

      // Los dos proveedores en una sola consulta: se necesita YouTube para el
      // ranking y Spotify para el reproductor del tema destacado.
      const { data: links } = await supabase
        .from('media_links')
        .select('entity_id, provider, play_count, url, external_id')
        .eq('entity_type', 'track')
        .in('entity_id', trackIds)

      const byTrack = new Map<string, Record<string, any>>()
      for (const link of links || []) {
        if (!byTrack.has(link.entity_id)) byTrack.set(link.entity_id, {})
        byTrack.get(link.entity_id)![link.provider] = link
      }

      const ranked: Record<string, RankedTrack[]> = {}

      for (const track of tracks || []) {
        const providers = byTrack.get(track.id)
        const youtube = providers?.youtube
        if (!youtube || youtube.play_count == null) continue

        if (!ranked[track.album_id]) ranked[track.album_id] = []
        ranked[track.album_id].push({
          ...(track as any),
          play_count: Number(youtube.play_count),
          url: youtube.url,
          youtubeId: youtube.external_id || null,
          spotifyId: providers?.spotify?.external_id || null,
        })
      }

      const result: Record<string, AlbumMedia> = {}
      for (const albumId of Object.keys(ranked)) {
        const sorted = ranked[albumId].sort((a, b) => b.play_count - a.play_count)
        const best = sorted[0]
        result[albumId] = {
          top: sorted.slice(0, topLimit),
          all: sorted,
          feature: best ? { spotifyId: best.spotifyId, youtubeId: best.youtubeId } : null,
        }
      }

      return result
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
