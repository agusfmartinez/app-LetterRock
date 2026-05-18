import axios from 'axios'

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000'

const api = axios.create({ baseURL: API_URL })

export async function getArtist(slug: string) {
  const { data } = await api.get(`/api/artists/${slug}`)
  return data as { artist: any; albums: any[] }
}

export async function getAlbum(id: string) {
  const { data } = await api.get(`/api/albums/${id}`)
  return data as { album: any; tracks: any[] }
}

export async function getTrack(id: string) {
  const { data } = await api.get(`/api/tracks/${id}`)
  return data as { track: any; comments: any[] }
}
