import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import CommentThread from '../components/common/CommentThread'
import CommentForm from '../components/forms/CommentForm'
import { getTrack } from '../services/api'
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
  const [track, setTrack] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, user:users(username, avatar_url)')
      .eq('entity_type', 'track')
      .eq('entity_id', id)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  useEffect(() => {
    getTrack(id)
      .then(data => setTrack(data.track))
      .finally(() => setLoading(false))
    fetchComments()
  }, [id])

  const handleComment = async ({ body }) => {
    if (!user) return
    await supabase.from('comments').insert({
      user_id: user.id,
      entity_type: 'track',
      entity_id: id,
      body,
    })
    fetchComments()
  }

  const handleDeleteComment = async (commentId) => {
    await supabase.from('comments').delete().eq('id', commentId)
    fetchComments()
  }

  if (loading) return <p className="text-gray-500">Cargando...</p>
  if (!track) return <p className="text-red-400">Canción no encontrada.</p>

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-rock-text">{track.title}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {track.track_number ? `Pista ${track.track_number} · ` : ''}
          {formatDuration(track.duration_ms)}
        </p>
      </div>

      <section>
        <h2 className="text-lg font-bold text-rock-text mb-3">
          Comentarios ({comments.length})
        </h2>
        <CommentThread comments={comments} onDelete={handleDeleteComment} />
        <CommentForm entityType="track" entityId={id} onSubmit={handleComment} />
      </section>
    </div>
  )
}
