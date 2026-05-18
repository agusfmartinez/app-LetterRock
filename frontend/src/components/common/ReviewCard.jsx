import RatingStars from './RatingStars'
import { useAuthStore } from '../../store/authStore'

export default function ReviewCard({ review, onEdit, onDelete, onLike }) {
  const { user } = useAuthStore()
  const isOwn = user && user.id === review.user_id
  const date = new Date(review.created_at).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {review.user?.avatar_url ? (
            <img
              src={review.user.avatar_url}
              alt={review.user.username}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-rock-accent flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {review.user?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-rock-text">{review.user?.username ?? 'Usuario'}</p>
            <p className="text-xs text-gray-500">{date}</p>
          </div>
        </div>
        <RatingStars value={review.rating} />
      </div>

      {review.text && (
        <p className="mt-3 text-gray-300 text-sm leading-relaxed">{review.text}</p>
      )}

      <div className="mt-3 flex items-center gap-4">
        <button
          onClick={onLike}
          className="text-xs text-gray-500 hover:text-rock-accent flex items-center gap-1"
        >
          ♥ {review.like_count ?? 0}
        </button>
        {isOwn && (
          <>
            {onEdit && (
              <button onClick={onEdit} className="text-xs text-gray-500 hover:text-white">
                Editar
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} className="text-xs text-gray-500 hover:text-red-400">
                Borrar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
