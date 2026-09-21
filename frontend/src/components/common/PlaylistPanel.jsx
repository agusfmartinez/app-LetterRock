import { useMemo } from 'react'
import MediaEmbed from './MediaEmbed'
import { IconExternal, IconSpotify, IconYouTubeMusic } from './Icons'
import {
  derivedTracks,
  parsePlaylistUrl,
  playlistEmbedProps,
  youtubeTempPlaylistUrl,
} from '../../services/playlists'

const SPOTIFY_PILL =
  'btn !text-[13px] gap-2 text-[#1DB954] border-[#1DB954]/40 hover:bg-[#1DB954]/10'
const YOUTUBE_PILL =
  'btn !text-[13px] gap-2 text-[#FF4E45] border-[#FF4E45]/40 hover:bg-[#FF4E45]/10'

/**
 * Abrir en el servicio lo que ya se está viendo incrustado.
 *
 * El embed suena en modo muestra —treinta segundos por tema en Spotify— así
 * que el link que lleva a la app no es un extra: es cómo se escucha de verdad.
 */
function OpenIn({ playlist }) {
  const spotify = playlist.provider === 'spotify'
  return (
    <a
      href={playlist.url}
      target="_blank"
      rel="noopener noreferrer"
      className={spotify ? SPOTIFY_PILL : YOUTUBE_PILL}
    >
      {spotify ? <IconSpotify size={16} /> : <IconYouTubeMusic size={16} />}
      {spotify
        ? (playlist.kind === 'album' ? 'Escuchar el álbum en Spotify' : 'Escuchar en Spotify')
        : 'Escuchar en YouTube'}
      <IconExternal size={13} />
    </a>
  )
}

/**
 * Cómo se escucha una colección.
 *
 * Arriba, la playlist que alguien pegó: la armó una persona y puede tener más
 * temas de los que la colección muestra. Abajo, lo que sale de las entradas
 * cargadas, que no depende de que nadie pegue nada.
 *
 * Los dos caminos conviven a propósito. La derivada no reemplaza a la adjunta
 * —un ranking de diez discos no es la playlist de cien temas que su autor
 * escuchó— y la adjunta no reemplaza a la derivada, porque la mayoría de las
 * colecciones no van a tener ninguna pegada.
 *
 * Todo lo que ofrece son links que se abren en el servicio. No hay nada que
 * cree playlists en la cuenta de quien mira: eso pedía conectar la cuenta con
 * Spotify, y LetterRock no lo hace. Copiar las URIs al portapapeles tampoco
 * quedó: era el plan B de ese camino, y sin el camino no significa nada.
 */
export default function PlaylistPanel({ playlistUrl, entries = [], media = {} }) {
  const attached = parsePlaylistUrl(playlistUrl)
  const tracks = useMemo(() => derivedTracks(entries, media), [entries, media])
  // Con una playlist de YouTube pegada, la derivada sobra: serían dos botones
  // rojos al lado, y el que armó una persona gana siempre.
  const youtubeUrl = attached?.provider === 'youtube'
    ? null
    : youtubeTempPlaylistUrl(tracks)

  // Sin playlist pegada y sin un solo tema vinculado no hay nada que escuchar.
  if (!attached && !youtubeUrl) return null

  return (
    <section className="w-full mt-12">
      <h2 className="font-display text-[34px] leading-none mb-5">Escuchar</h2>

      {/* A todo el ancho de la columna, como las entradas de arriba: una caja
          angosta al final de una página ancha parecía un resto. */}
      <div className="card w-full space-y-4">
        {attached && (
          <>
            <p className="font-mono text-[9.5px] tracking-[0.16em] text-gray-500">PLAYLIST</p>
            <MediaEmbed {...playlistEmbedProps(attached)} />
          </>
        )}

        {/* Las dos formas de escuchar, una al lado de la otra: son la misma
            decisión —dónde lo escucho— y separadas por una línea parecían dos
            secciones distintas. */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {attached && <OpenIn playlist={attached} />}
          {youtubeUrl && (
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={YOUTUBE_PILL}
            >
              <IconYouTubeMusic size={16} />
              Escuchar en YouTube
              <IconExternal size={13} />
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
