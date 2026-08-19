import { useNavigate } from 'react-router-dom'
import { useFavorite } from '../../hooks/useFavorite'

export default function FavoriteButton({ entityType, entityId, className = '' }) {
  const navigate = useNavigate()
  const { isFavorite, count, toggle, isPending, canFavorite } = useFavorite(entityType, entityId)

  const handleClick = () => {
    if (!canFavorite) return navigate('/auth/login')
    toggle()
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title={canFavorite ? (isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos') : 'Iniciá sesión para guardar'}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors disabled:opacity-50 ${
        isFavorite
          ? 'bg-rock-accent/10 border-rock-accent text-rock-accent'
          : 'bg-rock-card border-rock-border text-gray-400 hover:text-rock-accent hover:border-rock-accent'
      } ${className}`}
    >
      <span className="text-base leading-none">{isFavorite ? '♥' : '♡'}</span>
      {count > 0 && <span>{count}</span>}
    </button>
  )
}
