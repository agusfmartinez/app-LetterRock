import { Link } from 'react-router-dom'
import RatingStars from './RatingStars'
import { useConfirm } from './ConfirmDialog'
import { usePostMutations } from '../../hooks/usePosts'
import { useRole } from '../../hooks/useRole'
import { useAuthStore } from '../../store/authStore'
import { ENTITY_NOUN, entityLabel, entityPath } from '../../services/entities'

const KIND_ICON = {
  review: '★',
  favorite: '♥',
  comment: '💬',
  post: '✎',
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
  if (kind === 'post') return 'posteó sobre'
  return 'comentó en'
}

/**
 * Borrar el propio posteo y, para un editor, bajarlo sin borrarlo.
 *
 * Ocultar y borrar no son lo mismo a propósito: un editor que se equivoca puede
 * revertir, y el autor sigue viendo el suyo tachado —si desapareciera sin dejar
 * rastro lo volvería a escribir—.
 */
function PostActions({ activity }) {
  const user = useAuthStore(s => s.user)
  const { isEditor } = useRole()
  const { deletePost, setPostHidden } = usePostMutations()
  const confirm = useConfirm()

  const isOwn = !!user && activity.user_id === user.id
  if (!isOwn && !isEditor) return null

  const remove = async () => {
    const ok = await confirm({
      title: 'Borrar posteo',
      message: '¿Borrar este posteo? No se puede deshacer.',
    })
    if (ok) deletePost.mutate(activity.id)
  }

  return (
    <div className="flex items-center gap-3 mt-1">
      {isOwn && (
        <button onClick={remove} className="text-xs text-gray-600 hover:text-red-400">
          Borrar
        </button>
      )}
      {isEditor && (
        <button
          onClick={() => setPostHidden.mutate({ id: activity.id, hidden: !activity.hidden })}
          className="text-xs text-gray-600 hover:text-rock-accent"
        >
          {activity.hidden ? 'Restaurar' : 'Ocultar'}
        </button>
      )}
    </div>
  )
}

export default function ActivityItem({ activity }) {
  const { kind, user, entity_type, entity, created_at, rating, text } = activity
  const path = entity_type ? entityPath(entity_type, entity) : null
  const label = entity_type ? entityLabel(entity_type, entity) : null

  // Un posteo puede no colgar de nada: ahí la frase termina en el verbo y el
  // texto es todo el contenido.
  const isPost = kind === 'post'
  const hasTarget = !!entity_type

  return (
    <div className={`flex gap-3 py-3 border-b border-rock-border last:border-0 ${
      activity.hidden ? 'opacity-50' : ''
    }`}>
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
          {isPost && !hasTarget ? (
            ' posteó'
          ) : (
            <>
              {` ${verb(kind)} ${ENTITY_NOUN[entity_type]} `}
              {path ? (
                <Link to={path} className="text-rock-text font-medium hover:text-rock-accent">
                  {label}
                </Link>
              ) : (
                <span className="text-rock-text font-medium">{label}</span>
              )}
            </>
          )}
          {activity.hidden && (
            <span className="text-xs text-gray-500 ml-2 border border-rock-border rounded px-1">
              oculto
            </span>
          )}
        </p>

        {kind === 'review' && rating && (
          <div className="mt-1">
            <RatingStars value={rating} />
          </div>
        )}

        {/* El posteo no se recorta: el texto no es un extra del evento, es el
            evento. Una review sí, porque su título ya dice de qué se trata. */}
        {text && (
          <p className={`text-sm text-gray-300 mt-1 whitespace-pre-line ${isPost ? '' : 'line-clamp-3'}`}>
            {text}
          </p>
        )}

        <p className="text-xs text-gray-500 mt-1">{timeAgo(created_at)}</p>

        {isPost && <PostActions activity={activity} />}
      </div>
    </div>
  )
}
