import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import TrackRow from '../components/common/TrackRow'
import FavoriteButton from '../components/common/FavoriteButton'
import CommentThread from '../components/common/CommentThread'
import CommentForm from '../components/forms/CommentForm'
import { getAlbum } from '../services/api'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'

function formatDuration(ms) {
  if (!ms) return '—'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export default function TrackDetail() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const [comments, setComments] = useState([])

  // Lookup album_id from track (lightweight, cached)
  const { data: resolvedAlbumId } = useQuery({
    queryKey: ['track-album-id', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tracks')
        .select('album_id')
        .eq('id', id)
        .single()
      return data?.album_id || null
    },
    staleTime: Infinity,
  })

  // Album + tracks (shared cache with AlbumDetail!)
  const { data: albumData, isLoading } = useQuery({
    queryKey: ['album', resolvedAlbumId],
    queryFn: () => getAlbum(resolvedAlbumId),
    enabled: !!resolvedAlbumId,
  })

  const album = albumData?.album
  const artist = albumData?.artist
  const tracks = albumData?.tracks || []
  const track = tracks.find(t => t.id === id) || null

  const fetchComments = async (trackId) => {
    const { data } = await supabase
      .from('comments')
      .select('*, user:users(username, avatar_url)')
      .eq('entity_type', 'track')
      .eq('entity_id', trackId)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  useEffect(() => {
    setComments([])
    fetchComments(id)
  }, [id])

  const handleComment = async ({ body }) => {
    if (!user) return
    await supabase.from('comments').insert({
      user_id: user.id,
      entity_type: 'track',
      entity_id: id,
      body,
    })
    fetchComments(id)
  }

  const handleDeleteComment = async (commentId) => {
    await supabase.from('comments').delete().eq('id', commentId)
    fetchComments(id)
  }

  if (isLoading || (!track && resolvedAlbumId)) return <p className="text-gray-500">Cargando...</p>
  if (!track) return <p className="text-red-400">Canción no encontrada.</p>

  const year = album?.release_date ? new Date(album.release_date).getFullYear() : null

  return (
    <div className="space-y-10">
      {/* Back to artist */}
      {artist && (
        <Link
          to={`/artist/${artist.slug}`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-rock-accent text-sm transition-colors"
        >
          ← {artist.name}
        </Link>
      )}

      {/* Album header */}
      {album && (
        <div className="flex flex-col md:flex-row gap-6">
          <Link to={`/album/${album.id}`} className="w-48 h-48 rounded-lg overflow-hidden bg-rock-card flex-shrink-0 self-start block">
            {album.cover_url ? (
              <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl">💿</div>
            )}
          </Link>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest">
              {album.album_type || 'Álbum'}
            </p>
            <Link to={`/album/${album.id}`} className="text-3xl font-bold text-rock-text hover:text-rock-accent block mt-1">
              {album.title}
            </Link>
            {year && <p className="text-gray-400 mt-1">{year}</p>}
          </div>
        </div>
      )}

      {/* Split: tracklist + track content */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Tracklist */}
        {tracks.length > 0 && (
          <section className="md:w-2/5 md:flex-shrink-0">
            <h2 className="text-xl font-bold text-rock-text mb-2">
              Canciones ({tracks.length})
            </h2>
            <div className="bg-rock-card border border-rock-border rounded-lg py-2">
              {tracks.map((t, i) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  index={i}
                  selected={t.id === id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Track content */}
        <div className="flex-1 space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-rock-text">{track.title}</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {track.track_number ? `Pista ${track.track_number} · ` : ''}
              {formatDuration(track.duration_ms)}
            </p>
            <div className="mt-3">
              <FavoriteButton entityType="track" entityId={id} />
            </div>
          </div>

          {/* Lyrics */}
          <section>
            <h2 className="text-xl font-bold text-rock-text mb-2">Letra</h2>
            <div className="bg-rock-card border border-rock-border rounded-lg p-6">
              <p className="text-gray-300 text-sm leading-relaxed">Letra no disponible aún.</p>
              <p className="text-gray-600 text-xs italic mt-2">Próximamente: letras de canciones.</p>
            </div>
          </section>

          {/* Comments */}
          <section>
            <h2 className="text-xl font-bold text-rock-text mb-4">
              Comentarios ({comments.length})
            </h2>
            <div className="max-w-2xl space-y-4">
              <CommentForm entityType="track" entityId={id} onSubmit={handleComment} />
              {comments.length > 0 ? (
                <CommentThread comments={comments} onDelete={handleDeleteComment} />
              ) : (
                <p className="text-gray-500 text-sm">Sin comentarios aún.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
