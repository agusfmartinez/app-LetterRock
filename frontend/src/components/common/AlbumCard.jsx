import { useNavigate } from 'react-router-dom'
import { albumYear } from '../../services/dates'
import { IconDisc } from './Icons'

export default function AlbumCard({ album }) {
  const navigate = useNavigate()
  const year = albumYear(album)

  return (
    <div
      onClick={() => navigate(`/album/${album.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/album/${album.id}`)}
      className="group bg-rock-card rounded-lg overflow-hidden cursor-pointer shadow-card hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all"
    >
      <div className="aspect-square bg-rock-border/40 overflow-hidden">
        {album.cover_url ? (
          <img
            src={album.cover_url}
            alt={`Tapa de ${album.title}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-rock-border">
            <IconDisc className="w-10 h-10" />
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-rock-text truncate leading-snug">{album.title}</h3>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-500 tabular-nums">{year || '—'}</p>
          {album.avg_rating && (
            <p className="text-xs text-rock-accent tabular-nums">★ {parseFloat(album.avg_rating).toFixed(1)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
