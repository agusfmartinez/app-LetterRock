import { useNavigate } from 'react-router-dom'
import { useFavorite } from '../../hooks/useFavorite'
import { IconHeart } from './Icons'

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
      className={`btn ${
        isFavorite
          ? 'bg-rock-accent/10 border-rock-accent text-rock-accent'
          : 'btn-secondary !text-gray-400 hover:!text-rock-accent'
      } ${className}`}
    >
      {/* Relleno cuando está guardado: el contorno solo, en un botón chico, no
          se distingue del lleno de un vistazo. */}
      <IconHeart size={16} filled={isFavorite} />
      {count > 0 && <span>{count}</span>}
    </button>
  )
}
