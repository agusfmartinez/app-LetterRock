import { useState, useEffect } from 'react'
import { getArtist } from '../services/api'

export function useArtist(slug: string) {
  const [artist, setArtist] = useState<any>(null)
  const [albums, setAlbums] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    getArtist(slug)
      .then(data => {
        setArtist(data.artist)
        setAlbums(data.albums || [])
      })
      .catch(() => setError('Artista no encontrado.'))
      .finally(() => setLoading(false))
  }, [slug])

  return { artist, albums, loading, error }
}
