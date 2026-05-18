import { useNavigate } from 'react-router-dom'

export default function AlbumCard({ album }) {
  const navigate = useNavigate()
  const year = album.release_date ? new Date(album.release_date).getFullYear() : null

  return (
    <div
      onClick={() => navigate(`/album/${album.id}`)}
      className="bg-rock-card border border-rock-border rounded-lg overflow-hidden cursor-pointer hover:border-rock-accent transition-colors"
    >
      <div className="aspect-square bg-rock-dark overflow-hidden">
        {album.cover_url ? (
          <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-600">
            💿
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-rock-text truncate">{album.title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{year || '—'}</p>
        {album.avg_rating && (
          <p className="text-xs text-rock-accent mt-1">★ {parseFloat(album.avg_rating).toFixed(1)}</p>
        )}
      </div>
    </div>
  )
}
