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
        className="flex-1 bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />
      <button
        type="submit"
        disabled={!body.trim() || loading}
        className="bg-rock-accent text-white px-3 py-2 rounded text-sm hover:opacity-90 disabled:opacity-50 flex-shrink-0"
      >
        {loading ? '...' : 'Comentar'}
      </button>
    </form>
  )
}
