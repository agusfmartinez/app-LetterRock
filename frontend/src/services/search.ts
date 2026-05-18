import axios from 'axios'

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000'

export async function searchArtists(query: string): Promise<{ artists: any[]; message?: string }> {
  const { data } = await axios.get(`${API_URL}/api/search`, {
    params: { q: query, limit: 20 },
  })
  return { artists: data.artists || [], message: data.message }
}
