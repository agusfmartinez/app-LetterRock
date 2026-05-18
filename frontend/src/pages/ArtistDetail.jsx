import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import AlbumCard from '../components/common/AlbumCard'
import ReviewCard from '../components/common/ReviewCard'
import ReviewForm from '../components/forms/ReviewForm'
import { getArtist } from '../services/api'
import { useReviews } from '../hooks/useReviews'

export default function ArtistDetail() {
  const { slug } = useParams()
  const [artist, setArtist] = useState(null)
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { reviews, createReview, deleteReview } = useReviews('artist', artist?.id)

  useEffect(() => {
    setLoading(true)
    getArtist(slug)
      .then(data => {
        setArtist(data.artist)
        setAlbums(data.albums || [])
      })
      .catch(() => setError('Artista no encontrado.'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <p className="text-gray-500">Cargando...</p>
  if (error) return <p className="text-red-400">{error}</p>
  if (!artist) return null

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-32 h-32 rounded-lg overflow-hidden bg-rock-card flex-shrink-0">
          {artist.image_url ? (
            <img src={artist.image_url} alt={artist.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">🎸</div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-rock-text">{artist.name}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {artist.country && `${artist.country}`}
            {artist.country && artist.formed_year && ' · '}
            {artist.formed_year && `Formado en ${artist.formed_year}`}
          </p>
          {artist.bio && (
            <p className="text-gray-300 mt-3 max-w-2xl text-sm leading-relaxed">{artist.bio}</p>
          )}
        </div>
      </div>

      {/* Albums */}
      {albums.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-rock-text mb-4">
            Discografía ({albums.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map(a => <AlbumCard key={a.id} album={a} />)}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section>
        <h2 className="text-xl font-bold text-rock-text mb-4">Opiniones</h2>
        <div className="max-w-2xl space-y-4">
          <ReviewForm entityType="artist" entityId={artist.id} onSubmit={createReview} />
          {reviews.map(r => (
            <ReviewCard
              key={r.id}
              review={r}
              onDelete={() => deleteReview(r.id)}
            />
          ))}
          {reviews.length === 0 && (
            <p className="text-gray-500 text-sm">Sin opiniones aún. ¡Sé el primero!</p>
          )}
        </div>
      </section>
    </div>
  )
}
