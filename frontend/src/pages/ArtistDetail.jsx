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
  const [ingestingAlbums, setIngestingAlbums] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [albumFilter, setAlbumFilter] = useState('album')
  const { reviews, createReview, deleteReview } = useReviews('artist', artist?.id)

  useEffect(() => {
    setLoading(true)
    getArtist(slug)
      .then(data => {
        setArtist(data.artist)
        setAlbums(data.albums || [])
        setIngestingAlbums(data.ingestingAlbums || false)
      })
      .catch(() => setError('Artista no encontrado.'))
      .finally(() => setLoading(false))
  }, [slug])

  // Auto-poll mientras la ingesta está en curso
  useEffect(() => {
    if (!ingestingAlbums || !artist) return
    const interval = setInterval(() => {
      getArtist(slug).then(data => {
        if ((data.albums || []).length > 0) {
          setAlbums(data.albums)
          setIngestingAlbums(false)
          clearInterval(interval)
        }
      }).catch(() => clearInterval(interval))
    }, 3000)
    return () => clearInterval(interval)
  }, [ingestingAlbums, artist, slug])

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
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xl font-bold text-rock-text">Discografía</h2>
          <div className="flex gap-1 bg-rock-card border border-rock-border rounded-lg p-1">
            {[
              { value: 'album', label: 'Álbumes' },
              { value: 'single', label: 'Sencillos y EP' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setAlbumFilter(value)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  albumFilter === value
                    ? 'bg-rock-accent text-black font-semibold'
                    : 'text-gray-400 hover:text-rock-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {ingestingAlbums ? (
          <p className="text-gray-500 text-sm">Cargando discografía... recargá en unos segundos.</p>
        ) : (() => {
          const filtered = albums.filter(a => a.album_type === albumFilter)
          return filtered.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin resultados.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map(a => <AlbumCard key={a.id} album={a} />)}
            </div>
          )
        })()}
      </section>

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
