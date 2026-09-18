import { useState } from 'react'
import { Link } from 'react-router-dom'
import RatingStars from '../common/RatingStars'
import { useAuthStore } from '../../store/authStore'

export default function ReviewForm({ entityType, entityId, existingReview, onSubmit }) {
  const { user } = useAuthStore()
  const [rating, setRating] = useState(existingReview?.rating ?? 0)
  const [text, setText] = useState(existingReview?.text ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!user) {
    return (
      <div className="card">
        <p className="text-sm text-gray-400">
          <Link to="/auth/login" className="text-rock-accent hover:text-rock-accentBright">
            Entrá
          </Link>{' '}
          para puntuar y dejar tu opinión.
        </p>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Sin estrellas no se publica: una opinión sin puntaje no entra en los
    // promedios. El botón queda habilitado igual — apagado y sin explicación
    // no se entendía qué faltaba.
    if (!rating) { setError('Elegí un puntaje para publicar.'); return }
    setLoading(true)
    setError('')
    const err = await onSubmit({ rating, text, entityType, entityId })
    if (err) setError(err.message || 'Error al publicar')
    else { setText(''); setRating(0) }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3.5">
      <div className='flex gap-2'>
        <p className="text-[13.5px] text-gray-400">
          {existingReview ? 'Editar tu puntaje' : 'Tu puntaje'}
        </p>
        <RatingStars value={rating} onRate={n => { setRating(n); setError('') }} interactive />
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Escribí tu opinión..."
        rows={3}
        className="input resize-none !min-h-[88px]"
      />
      {error && <p className="field-error">{error}</p>}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary ml-auto"
        >
          {loading ? 'Publicando...' : 'Publicar'}
        </button>
      </div>
    </form>
  )
}
