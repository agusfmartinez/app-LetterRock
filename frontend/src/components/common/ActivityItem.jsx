import { Link } from 'react-router-dom'
import RatingStars from './RatingStars'
import { ENTITY_NOUN, entityLabel, entityPath } from '../../services/entities'

const KIND_ICON = {
  review: '★',
  favorite: '♥',
  comment: '💬',
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days} d`
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function verb(kind) {
  if (kind === 'review') return 'opinó sobre'
  if (kind === 'favorite') return 'guardó en favoritos'
  return 'comentó en'
}

export default function ActivityItem({ activity }) {
  const { kind, user, entity_type, entity, created_at, rating, text } = activity
  const path = entityPath(entity_type, entity)
  const label = entityLabel(entity_type, entity)

  return (
    <div className="flex gap-3 py-3 border-b border-rock-border last:border-0">
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt={user.username} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-rock-accent flex-shrink-0 flex items-center justify-center text-white text-sm font-bold">
          {user?.username?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-400">
          <span className="text-rock-accent mr-1">{KIND_ICON[kind]}</span>
          {user?.username ? (
            <Link to={`/user/${user.username}`} className="text-rock-text font-medium hover:text-rock-accent">
              {user.username}
            </Link>
          ) : (
            <span className="text-rock-text font-medium">Alguien</span>
          )}
          {` ${verb(kind)} ${ENTITY_NOUN[entity_type]} `}
          {path ? (
            <Link to={path} className="text-rock-text font-medium hover:text-rock-accent">
              {label}
            </Link>
          ) : (
            <span className="text-rock-text font-medium">{label}</span>
          )}
        </p>

        {kind === 'review' && rating && (
          <div className="mt-1">
            <RatingStars value={rating} />
          </div>
        )}

        {text && <p className="text-sm text-gray-300 mt-1 line-clamp-3">{text}</p>}

        <p className="text-xs text-gray-500 mt-1">{timeAgo(created_at)}</p>
      </div>
    </div>
  )
}
