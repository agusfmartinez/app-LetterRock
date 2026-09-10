import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import TrackRow from '../components/common/TrackRow'
import FavoriteButton from '../components/common/FavoriteButton'
import MediaEmbed from '../components/common/MediaEmbed'
import PlatformBadges, { youtubeMusicSearch } from '../components/common/PlatformBadges'
import { formatPlayCount } from '../hooks/useTopTracks'
import ReviewCard from '../components/common/ReviewCard'
import ReviewForm from '../components/forms/ReviewForm'
import { EmptyState, NotFoundLine, SkeletonFicha } from '../components/common/States'
import { IconArrowLeft } from '../components/common/Icons'
import { useReviews } from '../hooks/useReviews'
import { getAlbum } from '../services/api'
import { albumYear, trackDuration } from '../services/dates'
import { supabase } from '../services/supabaseClient'

const TYPE_LABEL = { album: 'Álbum', single: 'Sencillo', ep: 'EP' }

export default function TrackDetail() {
  const { id } = useParams()
  const { reviews, createReview, deleteReview } = useReviews('track', id)

  // El id del álbum sale de la canción: liviano y cacheado para siempre, porque
  // una canción no cambia de disco.
  const { data: resolvedAlbumId } = useQuery({
    queryKey: ['track-album-id', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tracks')
        .select('album_id')
        .eq('id', id)
        .single()
      return data?.album_id || null
    },
    staleTime: Infinity,
  })

  // Álbum + canciones. Comparte cache con AlbumDetail: venir de la ficha del
  // disco no cuesta una segunda consulta.
  const { data: albumData, isLoading } = useQuery({
    queryKey: ['album', resolvedAlbumId],
    queryFn: () => getAlbum(resolvedAlbumId),
    enabled: !!resolvedAlbumId,
  })

  const album = albumData?.album
  const artist = albumData?.artist
  const tracks = albumData?.tracks || []
  const track = tracks.find(t => t.id === id) || null

  if (isLoading || (!track && resolvedAlbumId)) {
    return <div className="py-11"><SkeletonFicha lines={4} /></div>
  }
  if (!track) return <NotFoundLine>Canción no encontrada.</NotFoundLine>

  const year = albumYear(album)

  return (
    <div className="animate-fade-up">
      {/* Sube al disco, que es el padre de la canción — no a la banda y no a
          history.back(). */}
      {album && (
        <Link
          to={`/album/${album.id}`}
          className="inline-flex items-center gap-2 text-[13.5px] text-gray-400 hover:text-rock-accent pt-4"
        >
          <IconArrowLeft size={14} /> {album.title}
        </Link>
      )}

      <div className="flex flex-wrap gap-9 items-start py-7">
        {/* — La canción — */}
        <div className="flex-1 min-w-[300px] order-2 md:order-1">
          <p className="kicker mb-3">
            {[
              track.track_number ? `Pista ${track.track_number}` : null,
              trackDuration(track),
              artist?.name,
            ].filter(Boolean).join(' · ')}
          </p>
          <h1 className="text-screen mb-4">{track.title}</h1>

          <div className="flex gap-2 flex-wrap mb-5">
            {trackDuration(track) && <span className="tag tag-accent">{trackDuration(track)}</span>}
            {track.view_count != null && (
              <span className="tag tag-neutral" title="Reproducciones en YouTube Music">
                ▶ {formatPlayCount(track.view_count)}
              </span>
            )}
          </div>

          <div className="flex gap-2.5 flex-wrap mb-6">
            <FavoriteButton entityType="track" entityId={id} />
            <PlatformBadges
              links={track.links || {}}
              fallbacks={{ youtube: youtubeMusicSearch(`${artist?.name || ''} ${track.title}`) }}
            />
          </div>

          {/* Reproductor: acá suena el tema, no el álbum entero. */}
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

          <section className="mt-8">
            <p className="font-mono text-[9.5px] tracking-[0.16em] text-gray-500 mb-2.5">LETRA</p>
            <p className="text-[14.5px] leading-relaxed text-gray-300 mb-1.5">
              Todavía no cargamos la letra de esta canción.
            </p>
            <p className="text-[13px] leading-relaxed text-gray-500">
              Si la tenés a mano, vas a poder proponerla cuando abramos las ediciones de letra.
            </p>
          </section>
        </div>

        {/* — El disco al que pertenece — */}
        {album && (
          <aside className="flex-none w-full md:w-[300px] order-1 md:order-2">
            <Link to={`/album/${album.id}`} className="group block mb-4">
              <div className="w-40 md:w-full aspect-square rounded-xl overflow-hidden bg-rock-card shadow-card">
                {album.cover_url ? (
                  <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover washed group-hover:filter-none transition-[filter]" />
                ) : (
                  <div className="w-full h-full flex flex-col justify-end p-4 bg-rock-border">
                    <span className="font-display text-lg leading-tight text-gray-300">{album.title}</span>
                  </div>
                )}
              </div>
              <p className="font-display text-lg mt-3 group-hover:text-rock-accent transition-colors">
                {album.title}
              </p>
              <p className="text-[13px] text-gray-500">
                {[TYPE_LABEL[album.album_type] || 'Álbum', year].filter(Boolean).join(' · ')}
              </p>
            </Link>

            {tracks.length > 0 && (
              <>
                <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 mb-2">
                  TODAS LAS CANCIONES
                </p>
                <div>
                  {tracks.map((t, i) => (
                    <TrackRow key={t.id} track={t} index={i} selected={t.id === id} />
                  ))}
                </div>
              </>
            )}
          </aside>
        )}
      </div>

      {/* Una canción se puntúa como cualquier otra obra. Hasta ahora era la
          única que no se podía, y a cambio tenía una caja de comentarios que
          ninguna otra ficha tenía. */}
      <section className="border-t border-rock-border pt-8">
        <h2 className="font-display text-3xl mb-5">Lo que escribieron</h2>
        <div className="max-w-2xl space-y-4">
          <ReviewForm entityType="track" entityId={id} onSubmit={createReview} />
          {reviews.length > 0 ? (
            reviews.map(r => (
              <ReviewCard key={r.id} review={r} onDelete={() => deleteReview(r.id)} />
            ))
          ) : (
            <EmptyState title="Todavía nadie opinó">
              Sé el primero en decir algo sobre esta canción.
            </EmptyState>
          )}
        </div>
      </section>
    </div>
  )
}
