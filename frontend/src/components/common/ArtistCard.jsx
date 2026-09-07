import { useNavigate } from 'react-router-dom'
import { isPerson, originLabel } from '../../services/artists'
import { IconGuitar } from './Icons'

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
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      className="group bg-rock-card rounded-lg overflow-hidden cursor-pointer shadow-card hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all"
    >
      <div className="aspect-square bg-rock-border/40 overflow-hidden">
        {artist.image_url ? (
          <img
            src={artist.image_url}
            alt={artist.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-rock-border">
            <IconGuitar className="w-10 h-10" />
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-rock-text truncate leading-snug">{artist.name}</h3>
        <div className="flex items-center justify-between mt-1">
          {/* El año de formación ubica a una banda; la fecha de nacimiento de un
              músico no dice nada de su obra y queda para su ficha. */}
          {!isPerson(artist) && originLabel(artist) ? (
            <p className="text-xs text-gray-500 truncate">{originLabel(artist)}</p>
          ) : <span />}
          {artist.avg_rating && (
            <p className="text-xs text-rock-accent tabular-nums flex-shrink-0">★ {parseFloat(artist.avg_rating).toFixed(1)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
