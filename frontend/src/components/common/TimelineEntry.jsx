import { Link } from 'react-router-dom'
import FavoriteButton from './FavoriteButton'
import SpotifyEmbed from './SpotifyEmbed'
import { effectivePrecision, formatReleaseDate } from '../../services/dates'
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
 * El año ya va en el encabezado del grupo, así que acá sólo se muestra la fecha
 * cuando aporta algo más: el mes o el día exacto.
 */
function PreciseDate({ album }) {
  const precision = effectivePrecision(album)
  if (precision !== 'day' && precision !== 'month') return null

  return (
    <p className="text-rock-accent text-xs font-bold tracking-widest uppercase">
      {formatReleaseDate(album)}
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
function NarrativeEntry({ entry }) {
  return (
    <article className="py-10 border-b border-rock-border last:border-0">
      <div className="max-w-2xl">
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

function AlbumEntry({ entry, topTracks }) {
  const album = entry.album
  const artist = album?.artist

  return (
    <article className="py-10 border-b border-rock-border last:border-0">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Portada */}
        <Link
          to={`/album/${album.id}`}
          className="w-full md:w-56 aspect-square rounded-lg overflow-hidden bg-rock-card flex-shrink-0 self-start block group"
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

        {/* Texto */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <PreciseDate album={album} />
            <Link
              to={`/album/${album.id}`}
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

          <Paragraphs text={entry.body_text} />

          <FavoriteButton entityType="album" entityId={album.id} />

          <TopTracks tracks={topTracks} />

          {album.external_spotify_id && (
            <SpotifyEmbed spotifyId={album.external_spotify_id} compact />
          )}
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
          <FavoriteButton entityType="artist" entityId={artist.id} />
        </div>
      </div>
    </article>
  )
}

export default function TimelineEntry({ entry, topTracks }) {
  if (entry.entry_type === 'album' && entry.album) {
    return <AlbumEntry entry={entry} topTracks={topTracks} />
  }
  if (entry.entry_type === 'artist' && entry.artist) return <ArtistEntry entry={entry} />
  return <NarrativeEntry entry={entry} />
}
