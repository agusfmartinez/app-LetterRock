import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import TrackRow from '../components/common/TrackRow'
import ReviewCard from '../components/common/ReviewCard'
import ReviewForm from '../components/forms/ReviewForm'
import { getAlbum } from '../services/api'
import { useReviews } from '../hooks/useReviews'

export default function AlbumDetail() {
  const { id } = useParams()
  const [album, setAlbum] = useState(null)
  const [tracks, setTracks] = useState([])
  const [ingestingTracks, setIngestingTracks] = useState(false)
  const [loading, setLoading] = useState(true)
  const { reviews, createReview, deleteReview } = useReviews('album', id)

  useEffect(() => {
    getAlbum(id)
      .then(data => {
        setAlbum(data.album)
        setTracks(data.tracks || [])
        setIngestingTracks(data.ingestingTracks || false)
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!ingestingTracks || !album) return
    const interval = setInterval(() => {
      getAlbum(id).then(data => {
        if ((data.tracks || []).length > 0) {
          setTracks(data.tracks)
          setIngestingTracks(false)
          clearInterval(interval)
        }
      }).catch(() => clearInterval(interval))
    }, 1000)
    return () => clearInterval(interval)
  }, [ingestingTracks, album, id])

  if (loading) return <p className="text-gray-500">Cargando...</p>
  if (!album) return <p className="text-red-400">Álbum no encontrado.</p>

  const year = album.release_date ? new Date(album.release_date).getFullYear() : null

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-48 h-48 rounded-lg overflow-hidden bg-rock-card flex-shrink-0 self-start">
          {album.cover_url ? (
            <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl">💿</div>
          )}
        </div>
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-widest">
            {album.album_type || 'Álbum'}
          </p>
          <h1 className="text-3xl font-bold text-rock-text mt-1">{album.title}</h1>
          {year && <p className="text-gray-400 mt-1">{year}</p>}
          {album.avg_rating && (
            <p className="text-rock-accent text-lg mt-2">
              ★ {parseFloat(album.avg_rating).toFixed(1)}
            </p>
          )}
        </div>
      </div>

      {/* Tracklist */}
      <section>
        <h2 className="text-xl font-bold text-rock-text mb-2">
          Canciones{tracks.length > 0 && ` (${tracks.length})`}
        </h2>
        {ingestingTracks ? (
          <p className="text-gray-500 text-sm">Cargando canciones...</p>
        ) : tracks.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin canciones disponibles.</p>
        ) : (
          <div className="bg-rock-card border border-rock-border rounded-lg py-2">
            {tracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} />)}
          </div>
        )}
      </section>

      {/* Reviews */}
      <section>
        <h2 className="text-xl font-bold text-rock-text mb-4">Opiniones</h2>
        <div className="max-w-2xl space-y-4">
          <ReviewForm entityType="album" entityId={id} onSubmit={createReview} />
          {reviews.map(r => (
            <ReviewCard key={r.id} review={r} onDelete={() => deleteReview(r.id)} />
          ))}
          {reviews.length === 0 && (
            <p className="text-gray-500 text-sm">Sin opiniones aún.</p>
          )}
        </div>
      </section>
    </div>
  )
}
