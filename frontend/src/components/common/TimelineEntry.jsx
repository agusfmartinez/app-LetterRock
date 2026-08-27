import { Link } from 'react-router-dom'
import AlbumLineup from './AlbumLineup'
import FavoriteButton from './FavoriteButton'
import MediaEmbed from './MediaEmbed'
import PlatformBadges, { youtubeMusicSearch } from './PlatformBadges'
import { albumYear, effectivePrecision, formatReleaseDate } from '../../services/dates'
import { formatPlayCount } from '../../hooks/useTopTracks'

function Paragraphs({ text }) {
  if (!text) return null
  return (
    <div className="space-y-3">
      {text.split(/\n+/).filter(Boolean).map((p, i) => (
        <p key={i} className="text-gray-300 leading-relaxed">{p}</p>
      ))}
    </div>
  )
}

/**
 * La fecha de edición del disco.
 *
 * En una timeline el año ya está en el encabezado del grupo, así que repetirlo
 * es ruido y sólo se muestra lo que agrega: el mes o el día exacto. En una lista
 * o un ranking no hay encabezados —van de corrido— y sin esto el disco queda sin
 * ninguna fecha a la vista.
 */
function PreciseDate({ album, standalone = false }) {
  const precision = effectivePrecision(album)
  if (!standalone && precision !== 'day' && precision !== 'month') return null

  const label = formatReleaseDate(album)
  if (!label) return null

  return (
    <p className="text-rock-accent text-xs font-bold tracking-widest uppercase">
      {label}
    </p>
  )
}

/** Temas destacados del disco, ordenados por reproducciones de YouTube. */
function TopTracks({ tracks }) {
  if (!tracks || tracks.length === 0) return null

  return (
    <div className="border border-rock-border rounded-lg divide-y divide-rock-border">
      <p className="text-gray-500 text-xs uppercase tracking-widest px-3 py-2">
        Más escuchados
      </p>
      {tracks.map((track, i) => (
        <div key={track.id} className="flex items-center gap-3 px-3 py-2">
          <span className="text-gray-600 text-xs w-4 flex-shrink-0">{i + 1}</span>
          <Link
            to={`/track/${track.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0 text-sm text-rock-text hover:text-rock-accent truncate"
          >
            {track.title}
          </Link>
          <span className="text-gray-500 text-xs flex-shrink-0 tabular-nums">
            {formatPlayCount(track.play_count)}
          </span>
        </div>
      ))}
      <p className="text-gray-600 text-[10px] px-3 py-1.5">
        Reproducciones en YouTube Music
      </p>
    </div>
  )
}

/** Bloque de texto suelto, sin disco ni banda asociada. */
function NarrativeEntry({ entry, standalone = false }) {
  return (
    <article className="py-10 border-b border-rock-border last:border-0">
      <div className="max-w-2xl">
        {/* Mismo caso que la fecha del disco: fuera de una timeline no hay
            encabezado de año que lo diga. */}
        {standalone && entry.year && (
          <p className="text-rock-accent text-xs font-bold tracking-widest uppercase mb-2">
            {entry.year}
          </p>
        )}
        {entry.image_url && (
          <img
            src={entry.image_url}
            alt={entry.title || ''}
            loading="lazy"
            className="w-full rounded-lg border border-rock-border mb-5"
          />
        )}
        {entry.title && (
          <h3 className="text-2xl font-bold text-rock-text mb-3">{entry.title}</h3>
        )}
        <Paragraphs text={entry.body_text} />
      </div>
    </article>
  )
}

function AlbumEntry({ entry, media, people, standalone = false }) {
  const album = entry.album
  const artist = album?.artist

  return (
    <article className="py-10 border-b border-rock-border last:border-0">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Portada y formación */}
        <div className="w-full md:w-56 flex-shrink-0 space-y-3">
          <Link
            to={`/album/${album.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full aspect-square rounded-lg overflow-hidden bg-rock-card block group"
          >
            {album.cover_url ? (
              <img
                src={album.cover_url}
                alt={album.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl">💿</div>
            )}
          </Link>

          {/*
            Quiénes estaban en la banda el año del disco. Va debajo de la
            portada y no en la columna de texto: es contexto de la ficha, no
            parte de lo que la colección tiene para decir sobre el disco.
          */}
          <AlbumLineup year={albumYear(album)} variant="badges" people={people} />
        </div>

        {/* Texto */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <PreciseDate album={album} standalone={standalone} />
            <Link
              to={`/album/${album.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-3xl font-bold text-rock-text hover:text-rock-accent block mt-1"
            >
              {album.title}
            </Link>
            {artist && (
              <Link
                to={`/artist/${artist.slug}`}
                className="text-gray-400 hover:text-rock-accent text-lg"
              >
                {artist.name}
              </Link>
            )}
          </div>

          {/*
            El texto de la entrada pisa al del disco, no lo duplica: `body_text`
            es lo que este disco significa EN ESTA colección, y `description` es
            qué es el disco en general. Sin texto propio, se muestra el general.
          */}
          <Paragraphs text={entry.body_text || album.description} />

          <div className="flex items-center gap-3 flex-wrap">
            <FavoriteButton entityType="album" entityId={album.id} />
            <PlatformBadges
              links={{ spotify: album.external_spotify_id
                ? { url: `https://open.spotify.com/album/${album.external_spotify_id}` }
                : null }}
              fallbacks={{
                youtube: youtubeMusicSearch(`${artist?.name || ''} ${album.title}`),
              }}
            />
          </div>

          <TopTracks tracks={media?.top} />

          {/*
            Suena el tema más escuchado del disco, no el álbum entero: el embed
            de track llena sus 152px, mientras que el de álbum reserva lugar para
            una lista que en modo "Muestra" no puede mostrar y deja un hueco.
            De paso, las dos plataformas quedan en la misma canción.
          */}
          <MediaEmbed
            compact
            spotify={
              media?.feature?.spotifyId
                ? { type: 'track', id: media.feature.spotifyId }
                : album.external_spotify_id
                  ? { type: 'album', id: album.external_spotify_id }
                  : null
            }
            youtube={media?.feature?.youtubeId ? { videoId: media.feature.youtubeId } : null}
          />
        </div>
      </div>
    </article>
  )
}

function ArtistEntry({ entry }) {
  const artist = entry.artist

  return (
    <article className="py-10 border-b border-rock-border last:border-0">
      <div className="flex flex-col md:flex-row gap-8">
        <Link
          to={`/artist/${artist.slug}`}
          className="w-full md:w-56 aspect-square rounded-lg overflow-hidden bg-rock-card flex-shrink-0 self-start block"
        >
          {artist.image_url ? (
            <img
              src={artist.image_url}
              alt={artist.name}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl">🎸</div>
          )}
        </Link>

        <div className="flex-1 min-w-0 space-y-4">
          <Link
            to={`/artist/${artist.slug}`}
            className="text-3xl font-bold text-rock-text hover:text-rock-accent block"
          >
            {artist.name}
          </Link>
          <Paragraphs text={entry.body_text} />
          <div className="flex items-center gap-3 flex-wrap">
            <FavoriteButton entityType="artist" entityId={artist.id} />
            <PlatformBadges
              fallbacks={{ youtube: youtubeMusicSearch(artist.name) }}
            />
          </div>
        </div>
      </div>
    </article>
  )
}

/**
 * `standalone` = esta entrada se lee sola, sin el encabezado de año que la
 * timeline pone arriba de cada grupo. Lo usan las listas y los rankings.
 */
export default function TimelineEntry({ entry, media, people, standalone = false }) {
  if (entry.entry_type === 'album' && entry.album) {
    return <AlbumEntry entry={entry} media={media} people={people} standalone={standalone} />
  }
  if (entry.entry_type === 'artist' && entry.artist) return <ArtistEntry entry={entry} />
  return <NarrativeEntry entry={entry} standalone={standalone} />
}
