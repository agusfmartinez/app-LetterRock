import { useState } from 'react'
import { Link } from 'react-router-dom'
import RatingStars from '../common/RatingStars'
import { useAuthStore } from '../../store/authStore'

export default function ReviewForm({ entityType, entityId, existingReview, onSubmit, onCancel }) {
  const { user } = useAuthStore()
  const [rating, setRating] = useState(existingReview?.rating ?? 0)
  const [text, setText] = useState(existingReview?.text ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!user) {
    return (
      <p className="text-gray-400 text-sm">
        <Link to="/auth/login" className="text-rock-accent hover:underline">
          Iniciá sesión
        </Link>{' '}
        para dejar una opinión.
      </p>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rating) return
    setLoading(true)
    setError('')
    const err = await onSubmit({ rating, text, entityType, entityId })
    if (err) setError(err.message || 'Error al publicar')
    else { setText(''); setRating(0) }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-rock-text">
        {existingReview ? 'Editar opinión' : 'Dejá tu opinión'}
      </h3>
      <RatingStars value={rating} onRate={setRating} interactive />
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Escribí tu opinión (opcional)..."
        rows={3}
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent resize-none"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!rating || loading}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Publicando...' : 'Publicar'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 px-4 py-1.5 text-sm hover:text-white"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
