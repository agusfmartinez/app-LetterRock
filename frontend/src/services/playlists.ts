/**
 * Playlists de una colección.
 *
 * Dos caminos distintos y complementarios:
 *
 * - **Adjunta**: alguien pega el link de una playlist que ya existe. Es la más
 *   fiel, porque la armó una persona: puede tener cien temas aunque el ranking
 *   muestre diez.
 * - **Derivada**: se arma con los temas que la colección ya tiene cargados. No
 *   depende de que nadie pegue nada, pero sólo llega hasta donde llegan las
 *   entradas.
 *
 * Ninguno de los dos necesita crear una playlist en la cuenta de nadie: crear
 * una en Spotify exige un token de usuario, que es otra discusión.
 */

export type PlaylistRef = {
  provider: 'spotify' | 'youtube'
  /** En Spotify un álbum también sirve como "playlist adjunta". */
  kind: 'playlist' | 'album'
  id: string
  /** La URL normalizada, para el link que abre la app del servicio. */
  url: string
}

const SPOTIFY_ID = /^[A-Za-z0-9]{16,40}$/
const YOUTUBE_LIST = /^[A-Za-z0-9_-]{10,}$/

/**
 * Lee un link pegado y devuelve a qué apunta, o `null` si no se reconoce.
 *
 * Acepta las formas con las que la gente comparte de verdad: el link del botón
 * "Compartir" (con su `?si=`), el `spotify:playlist:` de la app de escritorio,
 * un `watch?v=…&list=…` copiado de la barra del navegador, y los de
 * music.youtube.com.
 */
export function parsePlaylistUrl(raw: string | null | undefined): PlaylistRef | null {
  const text = (raw || '').trim()
  if (!text) return null

  // URI de la app de escritorio: spotify:playlist:37i9dQZF1DX...
  const uri = text.match(/^spotify:(playlist|album):([A-Za-z0-9]+)$/)
  if (uri) {
    return {
      provider: 'spotify',
      kind: uri[1] as 'playlist' | 'album',
      id: uri[2],
      url: `https://open.spotify.com/${uri[1]}/${uri[2]}`,
    }
  }

  let url: URL
  try {
    url = new URL(text.startsWith('http') ? text : `https://${text}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '')

  if (host === 'open.spotify.com') {
    // El path puede venir con el prefijo de idioma (/intl-es/playlist/...) y en
    // los links viejos con el usuario adelante (/user/x/playlist/...).
    const parts = url.pathname.split('/').filter(Boolean)
    const at = parts.findIndex(p => p === 'playlist' || p === 'album')
    const id = at >= 0 ? parts[at + 1] : null
    if (!id || !SPOTIFY_ID.test(id)) return null
    return {
      provider: 'spotify',
      kind: parts[at] as 'playlist' | 'album',
      id,
      url: `https://open.spotify.com/${parts[at]}/${id}`,
    }
  }

  if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtu.be') {
    const list = url.searchParams.get('list')
    if (!list || !YOUTUBE_LIST.test(list)) return null
    // Los mixes automáticos (RD…) no existen como playlist: los arma YouTube por
    // visitante y el embed queda en negro.
    if (/^RD/.test(list)) return null
    return {
      provider: 'youtube',
      kind: 'playlist',
      id: list,
      url: `https://www.youtube.com/playlist?list=${list}`,
    }
  }

  return null
}

/** Props para `MediaEmbed`: cada servicio incrusta la playlist a su manera. */
export function playlistEmbedProps(ref: PlaylistRef) {
  if (ref.provider === 'spotify') {
    return { spotify: { type: ref.kind, id: ref.id }, youtube: null }
  }
  return { spotify: null, youtube: { listId: ref.id } }
}

export function playlistLabel(ref: PlaylistRef): string {
  if (ref.provider === 'spotify') {
    return ref.kind === 'album' ? 'Álbum en Spotify' : 'Playlist en Spotify'
  }
  return 'Playlist en YouTube'
}

export type DerivedTrack = {
  entryId: string
  title: string
  artist: string | null
  spotifyId: string | null
  youtubeId: string | null
}

/**
 * Los temas de una colección, en el orden en que están cargados.
 *
 * Una entrada de canción aporta esa canción. Una de álbum aporta **su tema más
 * escuchado**, que es el mismo que ya suena en la tarjeta del disco: sin eso,
 * una lista de discos no derivaría ninguna playlist, y meter el álbum entero
 * convertiría diez discos en cien temas.
 *
 * `media` es lo que devuelve `useAlbumMedia`, indexado por álbum. De ahí salen
 * los ids de YouTube; los de Spotify ya vienen en la entrada.
 */
export function derivedTracks(entries: any[], media: Record<string, any>): DerivedTrack[] {
  const out: DerivedTrack[] = []

  for (const entry of entries) {
    if (entry.entry_type === 'track' && entry.track) {
      const album = entry.track.album
      const ranked = media[album?.id]?.all || []
      out.push({
        entryId: entry.id,
        title: entry.track.title,
        artist: album?.artist?.name || null,
        spotifyId: entry.track.external_spotify_id || null,
        youtubeId: ranked.find((t: any) => t.id === entry.track.id)?.youtubeId || null,
      })
      continue
    }

    if (entry.entry_type === 'album' && entry.album) {
      const feature = media[entry.album.id]?.feature
      const best = media[entry.album.id]?.all?.[0]
      if (!feature?.spotifyId && !feature?.youtubeId) continue
      out.push({
        entryId: entry.id,
        title: best?.title || entry.album.title,
        artist: entry.album.artist?.name || null,
        spotifyId: feature.spotifyId,
        youtubeId: feature.youtubeId,
      })
    }
  }

  return out
}

/** YouTube corta la playlist temporal en 50 videos. */
export const YOUTUBE_TEMP_LIMIT = 50

/**
 * Playlist temporal de YouTube, sin API ni cuota.
 *
 * `watch_videos?video_ids=` es un endpoint público que arma una lista al vuelo
 * con los ids que le pases. No queda guardada en ninguna cuenta —quien la abre
 * puede guardarla si quiere—, y por eso no consume la cuota diaria de la Data
 * API, que con una búsqueda por tema se agotaría con dos colecciones.
 */
export function youtubeTempPlaylistUrl(tracks: DerivedTrack[]): string | null {
  const ids = tracks.map(t => t.youtubeId).filter(Boolean).slice(0, YOUTUBE_TEMP_LIMIT)
  if (ids.length === 0) return null
  return `https://www.youtube.com/watch_videos?video_ids=${ids.join(',')}`
}

/**
 * Los temas como URIs de Spotify, uno por línea.
 *
 * Es lo que se pega dentro de una playlist en la app de escritorio de Spotify.
 * No es tan cómodo como un botón que la cree sola, pero eso necesita un token
 * del usuario —el de la app no alcanza— y esto funciona hoy, sin login.
 */
export function spotifyUriList(tracks: DerivedTrack[]): string {
  return tracks
    .map(t => t.spotifyId)
    .filter(Boolean)
    .map(id => `spotify:track:${id}`)
    .join('\n')
}
