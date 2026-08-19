import { supabase } from './supabaseClient'

export type EntityType = 'artist' | 'album' | 'track'

export type EntityRef = { entity_type: EntityType; entity_id: string }

/**
 * Resuelve en batch artistas / álbumes / canciones referenciados por
 * favoritos, reviews o comentarios. Una query por tipo, sin N+1.
 */
export async function fetchEntities(refs: EntityRef[]): Promise<Map<string, any>> {
  const byId = new Map<string, any>()
  if (refs.length === 0) return byId

  const idsOf = (type: EntityType) => [
    ...new Set(refs.filter(r => r.entity_type === type).map(r => r.entity_id)),
  ]

  const artistIds = idsOf('artist')
  const albumIds = idsOf('album')
  const trackIds = idsOf('track')

  const [artists, albums, tracks] = await Promise.all([
    artistIds.length
      ? supabase.from('artists').select('id, name, slug, image_url, formed_year').in('id', artistIds)
      : Promise.resolve({ data: [] }),
    albumIds.length
      ? supabase.from('albums').select('id, title, cover_url, release_date, album_type').in('id', albumIds)
      : Promise.resolve({ data: [] }),
    trackIds.length
      ? supabase.from('tracks').select('id, title, duration_ms, album:albums(id, title, cover_url)').in('id', trackIds)
      : Promise.resolve({ data: [] }),
  ])

  for (const list of [artists.data, albums.data, tracks.data]) {
    for (const item of list || []) byId.set((item as any).id, item)
  }
  return byId
}

/** Ruta al detalle de la entidad. Los artistas navegan por slug, el resto por id. */
export function entityPath(type: EntityType, entity: any): string | null {
  if (!entity) return null
  if (type === 'artist') return entity.slug ? `/artist/${entity.slug}` : null
  return `/${type}/${entity.id}`
}

export function entityLabel(type: EntityType, entity: any): string {
  if (!entity) return 'algo'
  return type === 'artist' ? entity.name : entity.title
}

export const ENTITY_NOUN: Record<EntityType, string> = {
  artist: 'la banda',
  album: 'el álbum',
  track: 'la canción',
}
