import { Link } from 'react-router-dom'
import FavoriteButton from './FavoriteButton'
import SpotifyEmbed from './SpotifyEmbed'

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

/** Bloque de texto suelto, sin disco ni banda asociada. */
function NarrativeEntry({ entry }) {
  return (
    <article className="max-w-2xl mx-auto py-12 border-b border-rock-border last:border-0">
      {entry.title && (
        <h3 className="text-2xl font-bold text-rock-text mb-4">{entry.title}</h3>
      )}
      <Paragraphs text={entry.body_text} />
    </article>
  )
}

function AlbumEntry({ entry }) {
  const album = entry.album
  const artist = album?.artist
  const year = album?.release_date
    ? new Date(album.release_date).getFullYear()
    : entry.year

  return (
    <article className="py-12 border-b border-rock-border last:border-0">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Portada */}
        <Link
          to={`/album/${album.id}`}
          className="w-full md:w-64 aspect-square rounded-lg overflow-hidden bg-rock-card flex-shrink-0 self-start block group"
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
            {year && (
              <p className="text-rock-accent font-bold text-sm tracking-widest">{year}</p>
            )}
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

          <div className="flex items-center gap-3">
            <FavoriteButton entityType="album" entityId={album.id} />
          </div>

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
    <article className="py-12 border-b border-rock-border last:border-0">
      <div className="flex flex-col md:flex-row gap-8">
        <Link
          to={`/artist/${artist.slug}`}
          className="w-full md:w-64 aspect-square rounded-lg overflow-hidden bg-rock-card flex-shrink-0 self-start block"
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
          <div>
            {entry.year && (
              <p className="text-rock-accent font-bold text-sm tracking-widest">{entry.year}</p>
            )}
            <Link
              to={`/artist/${artist.slug}`}
              className="text-3xl font-bold text-rock-text hover:text-rock-accent block mt-1"
            >
              {artist.name}
            </Link>
          </div>
          <Paragraphs text={entry.body_text} />
          <FavoriteButton entityType="artist" entityId={artist.id} />
        </div>
      </div>
    </article>
  )
}

export default function TimelineEntry({ entry }) {
  if (entry.entry_type === 'album' && entry.album) return <AlbumEntry entry={entry} />
  if (entry.entry_type === 'artist' && entry.artist) return <ArtistEntry entry={entry} />
  return <NarrativeEntry entry={entry} />
}
