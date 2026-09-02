import { useMemo, useState } from 'react'
import MediaEmbed from './MediaEmbed'
import {
  derivedTracks,
  parsePlaylistUrl,
  playlistEmbedProps,
  playlistLabel,
  spotifyUriList,
  YOUTUBE_TEMP_LIMIT,
  youtubeTempPlaylistUrl,
} from '../../services/playlists'
import { redirectUri, spotifyConfigured } from '../../services/spotifyAuth'
import { createSpotifyPlaylist } from '../../services/spotifyPlaylist'

const SPOTIFY_PILL =
  'text-xs border rounded-full px-3 py-1 transition-colors text-[#1DB954] border-[#1DB954]/40 hover:bg-[#1DB954]/10 disabled:opacity-50'

/**
 * Crear la playlist en la cuenta de quien está mirando.
 *
 * El permiso se pide recién en el click y no al entrar a la página: hasta que
 * alguien no quiere la playlist, Spotify no tiene nada que ver acá.
 */
function CreateInSpotify({ tracks, name, description }) {
  const [state, setState] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const withSpotify = tracks.filter(t => t.spotifyId).length
  if (withSpotify === 0) return null

  const create = async () => {
    setState('working')
    setError('')
    try {
      setResult(await createSpotifyPlaylist(name, description, tracks))
      setState('done')
    } catch (err) {
      setError(err.message)
      setState('idle')
    }
  }

  if (state === 'done' && result) {
    return (
      <div>
        <a href={result.url} target="_blank" rel="noopener noreferrer" className={SPOTIFY_PILL}>
          Abrir la playlist en Spotify ↗
        </a>
        <p className="text-gray-500 text-xs mt-1">
          {result.added} {result.added === 1 ? 'tema' : 'temas'} en tu cuenta
          {result.missing > 0 && ` · ${result.missing} sin vincular quedaron afuera`}
        </p>
      </div>
    )
  }

  return (
    <div>
      <button onClick={create} disabled={state === 'working'} className={SPOTIFY_PILL}>
        {state === 'working'
          ? 'Creando...'
          : `Crear playlist en Spotify (${withSpotify})`}
      </button>
      {error && (
        <div className="mt-1 max-w-sm">
          <p className="text-red-400 text-xs">{error}</p>
          {/* Cuando la URI de vuelta no está cargada en el dashboard, Spotify
              lo dice adentro del popup y acá no llega nada: quien cierra la
              ventana ve "cancelaste". Mostrar la URI exacta es lo único que
              convierte ese callejón en algo accionable. */}
          <p className="text-gray-600 text-xs mt-1">
            Si Spotify mostró un error de configuración, esta página pide volver a{' '}
            <code className="text-gray-500">{redirectUri()}</code>: tiene que estar cargada
            tal cual en los Redirect URIs de la app.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * El camino sin permisos: los temas al portapapeles.
 *
 * Sigue existiendo aunque esté el botón que crea la playlist sola, porque una
 * app de Spotify en modo desarrollo sólo autoriza a las cuentas cargadas a mano
 * en su dashboard. Para el resto, esto es lo que hay.
 */
function CopySpotify({ tracks, subdued }) {
  const [state, setState] = useState('idle')
  const uris = useMemo(() => spotifyUriList(tracks), [tracks])
  const count = uris ? uris.split('\n').length : 0

  if (count === 0) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(uris)
      setState('done')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }

  return (
    <div>
      <button
        onClick={copy}
        className={
          subdued
            ? 'text-xs text-gray-500 hover:text-rock-accent underline decoration-dotted'
            : SPOTIFY_PILL
        }
      >
        {state === 'done' ? `${count} temas copiados` : `Copiar ${count} temas para Spotify`}
      </button>
      {state === 'done' && (
        <p className="text-gray-500 text-xs mt-1">
          Pegalos dentro de una playlist en la app de escritorio de Spotify.
        </p>
      )}
      {state === 'error' && (
        <p className="text-red-400 text-xs mt-1">El navegador no dejó copiar.</p>
      )}
    </div>
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
 */
export default function PlaylistPanel({ playlistUrl, entries = [], media = {}, title = '' }) {
  const attached = parsePlaylistUrl(playlistUrl)
  const tracks = useMemo(() => derivedTracks(entries, media), [entries, media])
  const youtubeUrl = youtubeTempPlaylistUrl(tracks)
  const youtubeCount = Math.min(
    tracks.filter(t => t.youtubeId).length,
    YOUTUBE_TEMP_LIMIT
  )
  const canCreate = spotifyConfigured()

  if (!attached && tracks.length === 0) return null

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-rock-text">Escuchar</h2>

      {attached && (
        <div className="max-w-2xl space-y-2">
          <MediaEmbed {...playlistEmbedProps(attached)} />
          <a
            href={attached.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-rock-accent text-xs"
          >
            {playlistLabel(attached)} ↗
          </a>
        </div>
      )}

      {tracks.length > 0 && (
        <div className="space-y-2">
          {attached && (
            <p className="text-gray-500 text-sm">
              O con los {tracks.length} temas de esta página:
            </p>
          )}
          <div className="flex items-start gap-3 flex-wrap">
            {youtubeUrl && (
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs border rounded-full px-3 py-1 transition-colors text-[#FF4E45] border-[#FF4E45]/40 hover:bg-[#FF4E45]/10"
              >
                Escuchar {youtubeCount} temas en YouTube ↗
              </a>
            )}
            {canCreate && (
              <CreateInSpotify
                tracks={tracks}
                name={title || 'Playlist de LetterRock'}
                description={`${title} · armada en LetterRock`}
              />
            )}
            {/* Con el botón que la crea sola, copiar pasa a ser el plan B. */}
            <CopySpotify tracks={tracks} subdued={canCreate} />
          </div>
          {tracks.filter(t => t.youtubeId).length > YOUTUBE_TEMP_LIMIT && (
            <p className="text-gray-600 text-xs">
              YouTube corta en {YOUTUBE_TEMP_LIMIT} temas: van los primeros.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
