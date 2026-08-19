import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AlbumCard from '../components/common/AlbumCard'
import FavoriteButton from '../components/common/FavoriteButton'
import ReviewCard from '../components/common/ReviewCard'
import ReviewForm from '../components/forms/ReviewForm'
import { getArtist } from '../services/api'
import { useReviews } from '../hooks/useReviews'

export default function ArtistDetail() {
  const { slug } = useParams()
  const [albumFilter, setAlbumFilter] = useState('album')

  const { data, isLoading, error } = useQuery({
    queryKey: ['artist', slug],
    queryFn: () => getArtist(slug),
    refetchInterval: (query) => {
      const d = query.state.data
      return d?.ingestingAlbums ? 2000 : false
    },
  })

  const artist = data?.artist
  const albums = data?.albums || []
  const { reviews, createReview, deleteReview } = useReviews('artist', artist?.id)

  if (isLoading) return <p className="text-gray-500">Cargando...</p>
  if (error) return <p className="text-red-400">Artista no encontrado.</p>
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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-rock-text">{artist.name}</h1>
            <FavoriteButton entityType="artist" entityId={artist.id} />
          </div>
          <p className="text-gray-500 mt-1 text-sm">
            {artist.country && `${artist.country}`}
            {artist.country && artist.formed_year && ' · '}
            {artist.formed_year && `Formado en ${artist.formed_year}`}
          </p>
          {artist.bio && (
            <div className="mt-3 max-w-2xl space-y-2">
              {artist.bio.split(/\n+/).filter(Boolean).map((para, i) => (
                <p key={i} className="text-gray-300 text-sm leading-relaxed">{para}</p>
              ))}
            </div>
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
        {data?.ingestingAlbums ? (
          <p className="text-gray-500 text-sm">Cargando discografía...</p>
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
