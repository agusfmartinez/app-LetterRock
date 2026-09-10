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
        className="btn btn-secondary !min-h-0 !px-4 !py-1.5"
      >
        Seguir
      </Link>
    )
  }

  return (
    <button
      onClick={() => toggle()}
      disabled={isPending}
      className={`btn group !min-h-0 !px-4 !py-1.5 ${
        isFollowing ? 'btn-secondary !text-gray-400 hover:!text-rock-accentBright' : 'btn-primary'
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
