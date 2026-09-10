import { Link } from 'react-router-dom'
import { isPerson, originLabel } from '../../services/artists'

/*
 * Sin foto no va un emoji: va la inicial sobre el grano del fondo. Un emoji
 * repetido doce veces en una grilla es ruido, y además no dice cuál es cuál.
 */
function Placeholder({ name, round }) {
  return (
    <div
      className={`w-full h-full grid place-items-center bg-rock-border ${round ? 'rounded-full' : ''}`}
    >
      <span className="font-display text-3xl text-gray-500 select-none">
        {name?.[0]?.toUpperCase() ?? '?'}
      </span>
    </div>
  )
}

/**
 * La ficha de una banda en una grilla.
 *
 * `variant="circle"` es la del home — retrato redondo y el texto centrado
 * debajo, sin caja. `variant="card"` (por defecto) es la del catálogo y la
 * búsqueda, donde las fichas conviven con discos y necesitan borde.
 */
export default function ArtistCard({ artist, variant = 'card' }) {
  // Las bandas de la base tienen `id` de Supabase → van por slug. Las que
  // todavía no se guardaron vienen de MusicBrainz → van por su id externo.
  const to = `/artist/${artist.id ? artist.slug : artist.external_mb_id}`

  // El año de formación ubica a una banda; la fecha de nacimiento de un músico
  // no dice nada de su obra y queda para su ficha.
  const origin = !isPerson(artist) ? originLabel(artist) : null
  const rating = artist.avg_rating ? parseFloat(artist.avg_rating).toFixed(1) : null

  if (variant === 'circle') {
    return (
      <Link to={to} className="group text-center">
        <div className="aspect-square rounded-full overflow-hidden shadow-card
                        transition-transform duration-200 group-hover:-translate-y-1">
          {artist.image_url ? (
            <img
              src={artist.image_url}
              alt={artist.name}
              loading="lazy"
              className="w-full h-full object-cover washed transition-[filter] duration-200 group-hover:filter-none"
            />
          ) : (
            <Placeholder name={artist.name} round />
          )}
        </div>
        <p className="font-display text-base mt-3 leading-tight group-hover:text-rock-accent transition-colors">
          {artist.name}
        </p>
        {origin && <p className="text-[11.5px] text-gray-500 mt-0.5">{origin}</p>}
        {rating && <p className="text-[11.5px] text-rock-accent mt-1">★ {rating}</p>}
      </Link>
    )
  }

  return (
    <Link to={to} className="card card-hover !p-0 overflow-hidden group block">
      <div className="aspect-square overflow-hidden bg-rock-dark">
        {artist.image_url ? (
          <img
            src={artist.image_url}
            alt={artist.name}
            loading="lazy"
            className="w-full h-full object-cover washed transition-[filter,transform] duration-200
                       group-hover:filter-none group-hover:scale-[1.03]"
          />
        ) : (
          <Placeholder name={artist.name} />
        )}
      </div>
      <div className="p-3.5">
        <h3 className="font-display text-base truncate group-hover:text-rock-accent transition-colors">
          {artist.name}
        </h3>
        {origin && <p className="text-xs text-gray-500 mt-0.5">{origin}</p>}
        {rating && <p className="text-xs text-rock-accent mt-1">★ {rating}</p>}
      </div>
    </Link>
  )
}
