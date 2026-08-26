import axios from 'axios'
import { supabase } from './supabaseClient'

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000'

const api = axios.create({ baseURL: API_URL })

/** Cabecera con el token de Supabase: las rutas de escritura exigen rol de editor. */
async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Necesitás iniciar sesión')
  return { Authorization: `Bearer ${token}` }
}

export async function getArtist(slug: string) {
  const { data } = await api.get(`/api/artists/${slug}`)
  return data as { artist: any; albums: any[] }
}

export async function getAlbum(id: string) {
  const { data } = await api.get(`/api/albums/${id}`)
  return data as {
    album: any
    tracks: any[]
    artist: any
    links: Record<string, any>
    ingestingTracks: boolean
  }
}

export async function getTrack(id: string) {
  const { data } = await api.get(`/api/tracks/${id}`)
  return data as { track: any; comments: any[] }
}

export type YoutubeLinkResult = {
  playlistId: string
  source: 'topic' | 'title'
  matched: number
  total: number
  unmatched: string[]
  byPosition: number
}

/** Vincula el álbum con YouTube Music. Gasta ~102 unidades de cuota diaria. */
export async function linkAlbumToYoutube(id: string) {
  const { data } = await api.post(`/api/albums/${id}/youtube`, null, {
    headers: await authHeaders(),
  })
  return data as YoutubeLinkResult
}

export type ArtistLinkResult = {
  channelId: string
  channelWasCached: boolean
  skipped?: string
  albums: { album: string; matched?: number; total?: number; skipped?: string }[]
}

/**
 * Vincula toda la discografía del artista de una. Cuesta lo mismo que un solo
 * disco, porque el catálogo del canal se baja entero igual.
 */
export async function linkArtistDiscography(artistId: string) {
  const { data } = await api.post(`/api/artists/${artistId}/youtube`, null, {
    headers: await authHeaders(),
  })
  return data as ArtistLinkResult
}

/**
 * Vuelve a traer los metadatos de los discos desde Spotify. Respeta los campos
 * que el admin corrigió a mano.
 */
export async function refreshArtistFromSpotify(artistId: string) {
  const { data } = await api.post(`/api/artists/${artistId}/refresh-spotify`, null, {
    headers: await authHeaders(),
  })
  return data as { total: number; saved: number; errors: string[] }
}

/**
 * Importa de MusicBrainz el paso de los músicos por las bandas. Sirve para las
 * dos direcciones: en una banda trae su formación, en un solista trae las
 * bandas por las que pasó. Se puede repetir sin duplicar.
 */
export async function importArtistMembers(artistId: string) {
  const { data } = await api.post(`/api/artists/${artistId}/members`, null, {
    headers: await authHeaders(),
  })
  return data as {
    total: number
    saved: number
    linked: number
    skipped: number
    people: number
    /** Banda o músico, si la importación lo completó en esta corrida. */
    artistType: 'group' | 'person' | 'other' | null
  }
}

/** Refresca sólo las reproducciones. Cuesta 1 unidad cada 50 temas. */
export async function refreshYoutubeViews(id: string) {
  const { data } = await api.post(`/api/albums/${id}/youtube/refresh`, null, {
    headers: await authHeaders(),
  })
  return data as { updated: number }
}
