import { useNavigate } from 'react-router-dom'
import { isPerson, originLabel } from '../../services/artists'

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
        {/* El año de formación ubica a una banda; la fecha de nacimiento de un
            músico no dice nada de su obra y queda para su ficha. */}
        {!isPerson(artist) && originLabel(artist) && (
          <p className="text-xs text-gray-500 mt-0.5">{originLabel(artist)}</p>
        )}
        {artist.avg_rating && (
          <p className="text-xs text-rock-accent mt-1">★ {parseFloat(artist.avg_rating).toFixed(1)}</p>
        )}
      </div>
    </div>
  )
}
