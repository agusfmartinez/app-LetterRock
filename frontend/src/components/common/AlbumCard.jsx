import { Link } from 'react-router-dom'
import { albumYear } from '../../services/dates'

const KIND = { album: 'Álbum', single: 'Sencillo', ep: 'EP' }

/**
 * La tapa de un disco en una grilla.
 *
 * Al pasar el mouse el vinilo asoma por la derecha, como sacarlo de la funda.
 * El disco vive detrás de la tapa y se mueve él, no la tapa: si se moviera la
 * tapa la grilla se vería temblar. Por eso también sale hacia la derecha y no
 * hacia arriba — hacia arriba pisaría la fila de encima.
 *
 * En touch no hay hover, así que ahí no pasa nada y la tapa se lee igual.
 */
export default function AlbumCard({ album }) {
  const year = albumYear(album)
  const kind = KIND[album.album_type] || null
  const rating = album.avg_rating ? parseFloat(album.avg_rating).toFixed(1) : null

  return (
    <Link to={`/album/${album.id}`} className="group block">
      <div className="relative aspect-square">
        {/* El vinilo. Decorativo y detrás de todo: no compite con la tapa. */}
        <span
          aria-hidden="true"
          className="absolute top-[4%] left-0 w-[92%] aspect-square rounded-full shadow-card
                     transition-transform duration-500 ease-out
                     group-hover:translate-x-[26%] group-focus-visible:translate-x-[26%]"
          style={{
            background: `
              radial-gradient(circle at 50% 50%, #100d0b 0 3.4%, transparent 3.6%),
              radial-gradient(circle at 50% 50%, #c1592c 3.6% 26%, transparent 26.5%),
              repeating-radial-gradient(circle at 50% 50%, #241d18 0 2.5px, #17120f 2.5px 5px)
            `,
          }}
        />

        <div className="absolute inset-0 rounded-xl overflow-hidden bg-rock-card
                        shadow-card group-hover:shadow-card-hover transition-shadow">
          {album.cover_url ? (
            <img
              src={album.cover_url}
              alt={album.title}
              loading="lazy"
              className="w-full h-full object-cover washed transition-[filter] duration-200 group-hover:filter-none"
            />
          ) : (
            /* Sin tapa, el título ocupa su lugar: es lo que la tapa diría. */
            <div className="w-full h-full flex flex-col justify-end p-3.5 bg-rock-border">
              <span className="font-display text-[17px] leading-tight text-gray-300">
                {album.title}
              </span>
            </div>
          )}
        </div>
      </div>

      <p className="font-display text-[15px] mt-3.5 leading-tight truncate group-hover:text-rock-accent transition-colors">
        {album.title}
      </p>
      <p className="text-[13px] text-gray-500 mt-0.5">
        {[year, kind].filter(Boolean).join(' · ') || '—'}
      </p>
      {rating && <p className="text-[13px] text-rock-accent mt-0.5">★ {rating}</p>}
    </Link>
  )
}
