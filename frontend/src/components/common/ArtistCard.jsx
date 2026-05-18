import { useNavigate } from 'react-router-dom'

export default function ArtistCard({ artist }) {
  const navigate = useNavigate()

  const handleClick = () => {
    // DB artists have a Supabase `id` → use slug. Unsaved MB artists → use external_mb_id.
    const id = artist.id ? artist.slug : artist.external_mb_id
    if (id) navigate(`/artist/${id}`)
  }

  return (
    <div
      onClick={handleClick}
      className="bg-rock-card border border-rock-border rounded-lg overflow-hidden cursor-pointer hover:border-rock-accent transition-colors"
    >
      <div className="aspect-square bg-rock-dark overflow-hidden">
        {artist.image_url ? (
          <img src={artist.image_url} alt={artist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-600">
            🎸
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-rock-text truncate">{artist.name}</h3>
        {artist.formed_year && (
          <p className="text-xs text-gray-500 mt-0.5">Formado en {artist.formed_year}</p>
        )}
        {artist.avg_rating && (
          <p className="text-xs text-rock-accent mt-1">★ {parseFloat(artist.avg_rating).toFixed(1)}</p>
        )}
      </div>
    </div>
  )
}
