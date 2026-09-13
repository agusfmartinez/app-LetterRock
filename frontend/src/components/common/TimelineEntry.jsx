import { Link } from 'react-router-dom'
import AlbumLineup from './AlbumLineup'
import FavoriteButton from './FavoriteButton'
import MediaEmbed from './MediaEmbed'
import PlatformBadges, { youtubeMusicSearch } from './PlatformBadges'
import { albumYear, effectivePrecision, formatReleaseDate } from '../../services/dates'
import { formatPlayCount } from '../../hooks/useTopTracks'

function Paragraphs({ text, className = '' }) {
  if (!text) return null
  return (
    <div className={`space-y-3.5 ${className}`}>
      {text.split(/\n+/).filter(Boolean).map((p, i) => (
        <p key={i} className="text-[15.5px] text-gray-300 leading-[1.65] max-w-[62ch]">{p}</p>
      ))}
    </div>
  )
}

/** La tapa, o su inicial cuando no hay imagen: un emoji repetido no dice cuál es cuál. */
function Cover({ src, alt, to, className = '', ...linkProps }) {
  return (
    <Link
      to={to}
      className={`block group aspect-square rounded-xl overflow-hidden bg-rock-card shadow-card ${className}`}
      {...linkProps}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover washed transition-[filter,transform] duration-500
                     group-hover:filter-none group-hover:scale-[1.03]"
        />
      ) : (
        <div className="w-full h-full grid place-items-center bg-rock-border">
          <span className="font-display text-5xl text-gray-500">{alt?.[0]?.toUpperCase() ?? '?'}</span>
        </div>
      )}
    </Link>
  )
}

/**
 * Favorito y plataformas en una fila de controles de la misma altura.
 *
 * Antes el corazón era un botón y las plataformas unos chips más bajos: la fila
 * quedaba escalonada. Ahora todo usa la forma de `.btn`.
 */
function Actions({ children }) {
  return <div className="flex items-center gap-2.5 flex-wrap">{children}</div>
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

  return <p className="kicker mb-1.5">{label}</p>
}

/** Temas destacados del disco, ordenados por reproducciones de YouTube. */
function TopTracks({ tracks }) {
  if (!tracks || tracks.length === 0) return null

  return (
    <div className="card !p-0 overflow-hidden max-w-[520px]">
      <p className="font-mono text-[9.5px] tracking-[0.16em] text-gray-500 px-5 pt-4 pb-3">
        MÁS ESCUCHADOS
      </p>
      {tracks.map((track, i) => (
        <div key={track.id} className="flex items-center gap-3.5 px-5 py-2.5 border-t border-rock-border">
          <span className="font-mono text-gray-500 text-xs w-3.5 flex-none">{i + 1}</span>
          <Link
            to={`/track/${track.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0 text-[15px] hover:text-rock-accent truncate"
          >
            {track.title}
          </Link>
          <span className="text-gray-500 text-xs flex-none tabular-nums">
            ▶ {formatPlayCount(track.play_count)}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Bloque de texto suelto, sin disco ni banda asociada: una nota del editor.
 *
 * Va en una tarjeta tintada y a todo el ancho para que se lea como lo que es —
 * una pausa en el recorrido, no otro disco—. Sin la caja, entre dos fichas de
 * álbum se confundía con la descripción de la de arriba.
 */
function NarrativeEntry({ entry, standalone = false }) {
  return (
    <article className="py-8">
      <div className="w-full rounded-2xl bg-rock-accent/[0.07] px-6 py-7 md:px-9 md:py-8">
        <p className="font-mono text-[10px] tracking-[0.16em] text-rock-accent mb-3">
          {/* Mismo caso que la fecha del disco: fuera de una timeline no hay
              encabezado de año que lo diga. */}
          NOTA{standalone && entry.year ? ` · ${entry.year}` : ''}
        </p>
        {entry.title && (
          <h3
            className="font-display leading-[1.04] mb-5 max-w-[24ch]"
            style={{ fontSize: 'clamp(28px, 3.4vw, 36px)', letterSpacing: '-0.025em' }}
          >
            {entry.title}
          </h3>
        )}
        {entry.image_url && (
          <img
            src={entry.image_url}
            alt={entry.title || ''}
            loading="lazy"
            className="w-full aspect-video object-cover rounded-xl washed mb-6"
          />
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
        <div className="w-full md:w-60 flex-none">
          <Cover
            to={`/album/${album.id}`}
            src={album.cover_url}
            alt={album.title}
            target="_blank"
            rel="noopener noreferrer"
          />

          {/*
            Quiénes estaban en la banda el año del disco. Va debajo de la
            portada y no en la columna de texto: es contexto de la ficha, no
            parte de lo que la colección tiene para decir sobre el disco.
          */}
          <div className="mt-5">
            <AlbumLineup year={albumYear(album)} variant="badges" people={people} />
          </div>
        </div>

        {/* Texto */}
        <div className="flex-1 min-w-0 space-y-5">
          <div>
            <PreciseDate album={album} standalone={standalone} />
            <Link
              to={`/album/${album.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-[32px] leading-[1.02] hover:text-rock-accent block"
            >
              {album.title}
            </Link>
            {artist && (
              <Link
                to={`/artist/${artist.slug}`}
                className="text-gray-400 hover:text-rock-accent text-[17px] inline-block mt-1.5"
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

          <Actions>
            <FavoriteButton entityType="album" entityId={album.id} />
            <PlatformBadges
              links={{ spotify: album.external_spotify_id
                ? { url: `https://open.spotify.com/album/${album.external_spotify_id}` }
                : null }}
              fallbacks={{
                youtube: youtubeMusicSearch(`${artist?.name || ''} ${album.title}`),
              }}
            />
          </Actions>

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

/**
 * Una canción dentro de una colección.
 *
 * Se apoya en su disco para todo lo que la canción no tiene: la portada, el año
 * y la banda. Lo que sí es suyo es el reproductor, que arranca en ese tema y no
 * en el álbum entero — que es de lo que se trata una colección de canciones.
 */
function TrackEntry({ entry, media, standalone = false }) {
  const track = entry.track
  const album = track.album
  const artist = album?.artist

  // El id de YouTube de este tema, si la vinculación del álbum ya lo trajo.
  // Contra `all` y no contra `top`: un tema puede no estar entre los cuatro más
  // escuchados de su disco y aun así ser el que alguien eligió para la lista.
  const youtubeId = media?.all?.find(t => t.id === track.id)?.youtubeId || null

  return (
    <article className="py-10 border-b border-rock-border last:border-0">
      <div className="flex flex-col md:flex-row gap-8">
        <Cover
          to={`/track/${track.id}`}
          src={album?.cover_url}
          alt={album?.title || track.title}
          className="w-full md:w-44 flex-none self-start"
        />

        <div className="flex-1 min-w-0 space-y-5">
          <div>
            {standalone && album && <PreciseDate album={album} standalone />}
            <Link
              to={`/track/${track.id}`}
              className="font-display text-[32px] leading-[1.02] hover:text-rock-accent block"
            >
              {track.title}
            </Link>
            <p className="text-gray-400 text-[17px] mt-1.5">
              {artist && (
                <Link to={`/artist/${artist.slug}`} className="hover:text-rock-accent">
                  {artist.name}
                </Link>
              )}
              {artist && album && ' · '}
              {album && (
                <Link to={`/album/${album.id}`} className="hover:text-rock-accent">
                  {album.title}
                </Link>
              )}
            </p>
          </div>

          <Paragraphs text={entry.body_text} />

          <Actions>
            <FavoriteButton entityType="track" entityId={track.id} />
            <PlatformBadges
              links={
                track.external_spotify_id
                  ? { spotify: { url: `https://open.spotify.com/track/${track.external_spotify_id}` } }
                  : {}
              }
              fallbacks={{ youtube: youtubeMusicSearch(`${artist?.name || ''} ${track.title}`) }}
            />
          </Actions>

          <MediaEmbed
            compact
            spotify={track.external_spotify_id ? { type: 'track', id: track.external_spotify_id } : null}
            youtube={youtubeId ? { videoId: youtubeId } : null}
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
        <Cover
          to={`/artist/${artist.slug}`}
          src={artist.image_url}
          alt={artist.name}
          className="w-full md:w-60 flex-none self-start"
        />

        <div className="flex-1 min-w-0 space-y-5">
          <Link
            to={`/artist/${artist.slug}`}
            className="font-display text-[32px] leading-[1.02] hover:text-rock-accent block"
          >
            {artist.name}
          </Link>
          <Paragraphs text={entry.body_text} />
          <Actions>
            <FavoriteButton entityType="artist" entityId={artist.id} />
            <PlatformBadges fallbacks={{ youtube: youtubeMusicSearch(artist.name) }} />
          </Actions>
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
  if (entry.entry_type === 'track' && entry.track) {
    return <TrackEntry entry={entry} media={media} standalone={standalone} />
  }
  if (entry.entry_type === 'artist' && entry.artist) return <ArtistEntry entry={entry} />
  return <NarrativeEntry entry={entry} standalone={standalone} />
}
