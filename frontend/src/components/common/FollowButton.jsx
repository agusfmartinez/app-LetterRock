import { Link } from 'react-router-dom'
import { useFollow } from '../../hooks/useFollows'
import { useAuthStore } from '../../store/authStore'

/**
 * Seguir / Dejar de seguir a un usuario.
 *
 * No aparece en el perfil propio ni sin sesión: sin sesión no hay a quién
 * atribuir el follow, y ofrecerlo para que falle al tocarlo es peor que
 * mandar a iniciar sesión.
 */
export default function FollowButton({ userId }) {
  const { user } = useAuthStore()
  const { isFollowing, isSelf, toggle, isPending } = useFollow(userId)

  if (!userId || isSelf) return null

  if (!user) {
    return (
      <Link
        to="/auth/login"
        className="text-sm border border-rock-border rounded px-3 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent"
      >
        Seguir
      </Link>
    )
  }

  return (
    <button
      onClick={() => toggle()}
      disabled={isPending}
      className={`group text-sm rounded px-3 py-1 font-semibold transition-colors disabled:opacity-50 ${
        isFollowing
          ? 'border border-rock-border text-gray-400 hover:border-red-400 hover:text-red-400'
          : 'bg-rock-accent text-white hover:opacity-90'
      }`}
    >
      {/* Estando en "Siguiendo", el texto cambia recién al pasar por encima: en
          reposo se lee el estado, y al apuntarle se lee qué va a pasar. */}
      {isFollowing ? (
        <>
          <span className="group-hover:hidden">Siguiendo</span>
          <span className="hidden group-hover:inline">Dejar de seguir</span>
        </>
      ) : (
        'Seguir'
      )}
    </button>
  )
}
