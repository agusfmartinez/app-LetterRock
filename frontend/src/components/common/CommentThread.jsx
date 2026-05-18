import { useAuthStore } from '../../store/authStore'

function Comment({ comment, onDelete }) {
  const { user } = useAuthStore()
  const isOwn = user && user.id === comment.user_id
  const date = new Date(comment.created_at).toLocaleDateString('es-AR', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="flex gap-3 py-3 border-b border-rock-border last:border-0">
      <div className="w-7 h-7 rounded-full bg-rock-accent flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
        {comment.user?.username?.[0]?.toUpperCase() ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-rock-text">{comment.user?.username}</span>
          <span className="text-xs text-gray-500">{date}</span>
        </div>
        <p className="text-sm text-gray-300 mt-0.5">{comment.body}</p>
      </div>
      {isOwn && onDelete && (
        <button
          onClick={() => onDelete(comment.id)}
          className="text-xs text-gray-500 hover:text-red-400 flex-shrink-0"
        >
          ✕
        </button>
      )}
    </div>
  )
}

export default function CommentThread({ comments = [], onDelete }) {
  if (!comments.length) {
    return <p className="text-gray-500 text-sm">Sin comentarios aún.</p>
  }
  return (
    <div>
      {comments.map(c => (
        <Comment key={c.id} comment={c} onDelete={onDelete} />
      ))}
    </div>
  )
}
