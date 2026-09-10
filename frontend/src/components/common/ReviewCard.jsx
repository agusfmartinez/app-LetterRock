import { Link } from 'react-router-dom'
import RatingStars from './RatingStars'
import { ENTITY_NOUN, entityLabel, entityPath } from '../../services/entities'
import { useAuthStore } from '../../store/authStore'
import { useConfirm } from './ConfirmDialog'
import { IconHeart } from './Icons'

/**
 * `showEntity` sólo lo pide el perfil.
 *
 * En la ficha de un disco todas las opiniones son de ese disco y repetir el
 * título en cada tarjeta es ruido. En el perfil pasa lo contrario: son de cosas
 * distintas y sin decirlo la opinión no se entiende.
 */
export default function ReviewCard({ review, onEdit, onDelete, onLike, showEntity = false }) {
  const { user } = useAuthStore()
  const confirm = useConfirm()
  const isOwn = user && user.id === review.user_id
  const date = new Date(review.created_at).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {review.user?.avatar_url ? (
            <img
              src={review.user.avatar_url}
              alt={review.user.username}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 flex-none rounded-full bg-rock-accent/20 border border-rock-accentDim
                            grid place-items-center text-rock-accentBright text-sm font-bold">
              {review.user?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">{review.user?.username ?? 'Usuario'}</p>
            <p className="text-xs text-gray-500">{date}</p>
          </div>
        </div>
        <RatingStars value={review.rating} />
      </div>

      {showEntity && review.entity_type && (
        <p className="mt-2 text-xs text-gray-500">
          {`sobre ${ENTITY_NOUN[review.entity_type]} `}
          {entityPath(review.entity_type, review.entity) ? (
            <Link
              to={entityPath(review.entity_type, review.entity)}
              className="text-rock-text hover:text-rock-accent font-medium"
            >
              {entityLabel(review.entity_type, review.entity)}
            </Link>
          ) : (
            <span className="text-rock-text font-medium">
              {entityLabel(review.entity_type, review.entity)}
            </span>
          )}
        </p>
      )}

      {review.text && (
        <p className="mt-3.5 text-[15px] text-gray-300 leading-relaxed whitespace-pre-line">
          {review.text}
        </p>
      )}

      <div className="mt-3.5 flex items-center gap-4">
        <button
          onClick={onLike}
          className="text-xs text-gray-500 hover:text-rock-accent flex items-center gap-1.5"
        >
          <IconHeart size={13} /> {review.like_count ?? 0}
        </button>
        {isOwn && (
          <>
            {onEdit && (
              <button onClick={onEdit} className="text-xs text-gray-500 hover:text-rock-text">
                Editar
              </button>
            )}
            {onDelete && (
              <button
                onClick={async () => {
                  // Lo que se pierde es texto que escribió el usuario y no está
                  // en ningún otro lado.
                  const ok = await confirm({
                    title: 'Borrar opinión',
                    message: '¿Borrar tu opinión? No se puede deshacer.',
                  })
                  if (ok) onDelete()
                }}
                className="text-xs text-gray-500 hover:text-rock-accentBright"
              >
                Borrar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
