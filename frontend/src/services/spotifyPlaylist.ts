import { authorizeSpotify } from './spotifyAuth'
import type { DerivedTrack } from './playlists'

const API = 'https://api.spotify.com/v1'

/** Spotify acepta hasta 100 temas por pedido. */
const BATCH = 100

async function call(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    const reason = detail?.error?.reason ? ` [${detail.error.reason}]` : ''
    const message = (detail?.error?.message || `Spotify respondió ${response.status}.`) + reason
    // Qué endpoint falló, siempre: un 403 en `/me` y un 403 al crear la playlist
    // se arreglan en lugares distintos del dashboard, y "Forbidden" a secas no
    // distingue uno del otro.
    const where = `${init.method || 'GET'} ${path}`
    const error: any = new Error(
      response.status === 403
        ? `${message} (${where}). Revisá en el dashboard de Spotify que la app tenga habilitada la Web API y que tu cuenta esté en Users and Access. Mientras tanto funciona el botón de copiar los temas.`
        : `${message} (${where})`
    )
    // El código sobrevive al mensaje: quien llama decide si un 403 es el final
    // del camino o algo para reintentar de otra forma.
    error.status = response.status
    throw error
  }

  return response.status === 204 ? null : response.json()
}

export type CreatedPlaylist = { url: string; added: number; missing: number }

/**
 * Crea la playlist, pública si se puede y privada si no.
 *
 * El primer intento va público porque la playlist nace de una colección pública
 * y el sentido de armarla es pasarla. Pero Spotify devuelve 403 al crear
 * públicas en algunas cuentas —con el permiso otorgado igual— y ahí una privada
 * es infinitamente mejor que ninguna: se hace pública desde Spotify en un
 * toque. El reintento sólo cambia esa bandera; cualquier otro error sube tal
 * cual, porque no lo arregla insistir.
 */
async function createPlaylist(token: string, name: string, description: string) {
  // `/me/playlists`, no `/users/{id}/playlists`: ese último se eliminó en la
  // migración de febrero de 2026 y desde el 9 de marzo devuelve 403 a todos.
  // Como efecto colateral ya no hace falta preguntar quién es el usuario: el
  // token lo dice.
  const path = '/me/playlists'
  const body = (isPublic: boolean) =>
    JSON.stringify({ name, public: isPublic, description })

  try {
    return await call(token, path, { method: 'POST', body: body(true) })
  } catch (err: any) {
    if (err?.status !== 403) throw err
    return await call(token, path, { method: 'POST', body: body(false) })
  }
}

/**
 * Crea la playlist en la cuenta de quien está mirando.
 *
 * Pide el permiso en el momento, la crea, le mete los temas y devuelve el link.
 * El token queda en esta función: no se guarda, no vuelve al que llama, y la
 * próxima vez se pide de nuevo. Es un permiso para una acción, no una sesión.
 *
 * Los temas sin id de Spotify quedan afuera y se informan: la colección puede
 * tener discos que nunca se vincularon, y una playlist a la que le faltan tres
 * temas sin avisar es peor que una que lo dice.
 */
export async function createSpotifyPlaylist(
  name: string,
  description: string,
  tracks: DerivedTrack[]
): Promise<CreatedPlaylist> {
  const uris = tracks.filter(t => t.spotifyId).map(t => `spotify:track:${t.spotifyId}`)
  if (uris.length === 0) throw new Error('Ningún tema de esta colección está vinculado a Spotify.')

  const token = await authorizeSpotify()

  const playlist = await createPlaylist(token, name, description.slice(0, 300))

  // `/items` y no `/tracks`: los endpoints de temas de una playlist se
  // renombraron en la misma migración de febrero de 2026.
  for (let i = 0; i < uris.length; i += BATCH) {
    await call(token, `/playlists/${playlist.id}/items`, {
      method: 'POST',
      body: JSON.stringify({ uris: uris.slice(i, i + BATCH) }),
    })
  }

  return {
    url: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`,
    added: uris.length,
    missing: tracks.length - uris.length,
  }
}
