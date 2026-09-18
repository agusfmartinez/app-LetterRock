import { useEffect } from 'react'
import FavoriteButton from './FavoriteButton'
import MediaEmbed from './MediaEmbed'
import PlatformBadges, { youtubeMusicSearch } from './PlatformBadges'
import ReviewCard from './ReviewCard'
import ArrowLink from './ArrowLink'
import { IconArrowLeft } from './Icons'
import { formatPlayCount } from '../../hooks/useTopTracks'
import { trackDuration } from '../../services/dates'
import { useReviews } from '../../hooks/useReviews'

/**
 * La canción elegida, en la misma columna donde estaba el listado.
 *
 * Dos lugares la usan:
 * - La pila de la discografía: es un resumen — el reproductor, las
 *   plataformas, guardar y las últimas dos opiniones — con un link a la ficha
 *   del disco con el tema abierto, que es donde se escribe.
 * - La ficha del disco (`inPage`): ahí ES la página de la canción. Muestra la
 *   letra en lugar del resumen de opiniones, porque las opiniones completas,
 *   con la caja para escribir, van abajo en la página.
 */
export default function TrackPanel({ track, artistName, albumId, onBack, inPage = false }) {
  // En la ficha las opiniones las trae la página: no se piden dos veces.
  const { reviews } = useReviews('track', inPage ? undefined : track.id)

  // Escape vuelve al listado, igual que la flecha. En la pila, Escape ya cierra
  // el disco, así que acá se frena el evento para que no haga las dos cosas.
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onBack()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onBack])

  const dur = trackDuration(track)
  const shown = reviews.slice(0, 2)

  return (
    <div className="flex flex-col h-full animate-fade-up">
      <div className="flex items-center gap-2.5 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="btn btn-secondary !min-h-0 !px-3 !py-1.5 !text-[12.5px] gap-1.5 flex-none"
        >
          <IconArrowLeft size={14} /> Canciones
        </button>
        {!inPage && <ArrowLink to={`/album/${albumId || track.album_id}?tema=${track.id}`} className="ml-auto">Ver canción</ArrowLink>}
      </div>

      <div className={inPage ? 'pt-3' : 'flex-1 min-h-0 overflow-y-auto pr-1 -mr-1'}>
        <h3 className={`font-display leading-tight mb-1.5 ${inPage ? 'text-[26px] sm:text-3xl' : 'text-[21px] sm:text-2xl'}`}>
          {track.title}
        </h3>
        <p className="kicker mb-3">
          {[
            track.track_number ? `Pista ${track.track_number}` : null,
            dur,
            track.view_count != null ? `▶ ${formatPlayCount(track.view_count)}` : null,
          ].filter(Boolean).join(' · ')}
        </p>

        <div className="flex gap-2 flex-wrap mb-3.5">
          <FavoriteButton entityType="track" entityId={track.id} />
          <PlatformBadges
            links={track.links || {}}
            fallbacks={{ youtube: youtubeMusicSearch(`${artistName || ''} ${track.title}`) }}
          />
        </div>

        {/* Acá suena el tema, no el disco entero. */}
        <MediaEmbed
          compact
          spotify={
            track.links?.spotify?.external_id
              ? { type: 'track', id: track.links.spotify.external_id }
              : null
          }
          youtube={
            track.links?.youtube?.external_id
              ? { videoId: track.links.youtube.external_id }
              : null
          }
        />

        {inPage ? (
          <div className="mt-7">
            <p className="kicker mb-2.5">Letra</p>
            <p className="text-[14.5px] leading-relaxed text-gray-300 mb-1.5">
              Todavía no cargamos la letra de esta canción.
            </p>
            <p className="text-[13px] leading-relaxed text-gray-500">
              Si la tenés a mano, vas a poder proponerla cuando abramos las ediciones de letra.
            </p>
          </div>
        ) : (
        <div className="mt-5">
          <p className="kicker mb-2.5">
            {reviews.length === 0 ? 'Opiniones' : `Opiniones (${reviews.length})`}
          </p>

          {reviews.length === 0 ? (
            <p className="text-[13.5px] text-gray-500">
              Todavía nadie escribió sobre esta canción. Se escribe en su ficha.
            </p>
          ) : (
            <div className="space-y-3">
              {shown.map(r => <ReviewCard key={r.id} review={r} />)}
              {reviews.length > shown.length && (
                <p className="text-[13px] text-gray-500">
                  {reviews.length - shown.length} más en la ficha de la canción.
                </p>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
