import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'

export default function CommentForm({ entityType, entityId, onSubmit }) {
  const { user } = useAuthStore()
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)

  if (!user) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    setLoading(true)
    await onSubmit({ body: body.trim(), entityType, entityId })
    setBody('')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-3">
      <input
        type="text"
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Agregar comentario..."
        className="input flex-1"
      />
      <button
        type="submit"
        disabled={!body.trim() || loading}
        className="btn btn-primary flex-none"
      >
        {loading ? '...' : 'Comentar'}
      </button>
    </form>
  )
}
