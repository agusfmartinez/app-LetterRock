/**
 * Autorización de Spotify para una acción puntual, en una ventana aparte.
 *
 * No es "Login con Spotify": no crea sesión en LetterRock, no toca la cuenta de
 * la app, y el token no se guarda en ningún lado —vive en la variable de la
 * función que lo pidió y se muere con la pestaña—. Lo único que hace es pedirle
 * permiso a quien está mirando para crear una playlist en *su* cuenta.
 *
 * Es el flujo Authorization Code + PKCE, que existe justamente para esto: no
 * necesita el client secret, así que puede correr entero en el navegador y no
 * hace falta backend. El client_id sí es público, por diseño.
 *
 * LÍMITE IMPORTANTE: una app de Spotify en modo desarrollo sólo deja autorizar a
 * las cuentas que estén cargadas a mano en el dashboard (hasta 25). Para que
 * pueda cualquiera hay que pedir la extensión de cuota, que Spotify revisa a
 * mano. Por eso el botón de copiar los temas sigue estando: es el camino que
 * funciona para todo el mundo.
 */

const CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string) || ''

/**
 * Los dos permisos de escritura de playlists, y nada más: no pedimos leer nada
 * de la biblioteca.
 *
 * Van los dos porque cuál hace falta depende de si la playlist sale pública o
 * privada, y eso se decide recién al crearla —Spotify rechaza la pública en
 * algunas cuentas y hay que reintentar privada—. Pedir uno solo dejaría ese
 * reintento sin permiso.
 */
const SCOPES = 'playlist-modify-public playlist-modify-private'

export function spotifyConfigured(): boolean {
  return CLIENT_ID !== ''
}

/**
 * Tiene que coincidir *exactamente* con una de las URIs cargadas en el
 * dashboard de Spotify. Sale de `location.origin` para que sirva igual en
 * desarrollo y en producción, pero cada origen hay que darlo de alta allá.
 *
 * En desarrollo Spotify ya no acepta `localhost`: hay que entrar por
 * `http://127.0.0.1:5173`, no por `http://localhost:5173`.
 */
export function redirectUri(): string {
  return `${window.location.origin}/spotify-callback`
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

export const SPOTIFY_MESSAGE = 'letterrock:spotify-auth'

/**
 * Abre la ventana de permisos y devuelve un access token.
 *
 * La ventana se abre en blanco y recién después se la manda a Spotify: armar la
 * URL necesita `crypto.subtle`, que es asíncrono, y para entonces el navegador
 * ya no considera que la apertura viene del click —la bloquearía—.
 */
export async function authorizeSpotify(): Promise<string> {
  if (!CLIENT_ID) throw new Error('Falta configurar VITE_SPOTIFY_CLIENT_ID.')

  // Spotify sólo acepta `http://` en loopback numérico: `localhost` no se puede
  // registrar. Y no alcanza con mandar 127.0.0.1 igual, porque la ventana de
  // vuelta quedaría en otro origen que esta pestaña y el `postMessage` con el
  // código no llegaría nunca. Cortamos acá: abrir el popup sería abrirlo para
  // que muera en la pantalla de Spotify.
  if (window.location.hostname === 'localhost') {
    const port = window.location.port ? `:${window.location.port}` : ''
    throw new Error(
      `Entrá a la app por http://127.0.0.1${port} en vez de localhost: Spotify no acepta "localhost" como dirección de vuelta.`
    )
  }

  const popup = window.open('about:blank', 'letterrock-spotify', 'width=460,height=730')
  if (!popup) throw new Error('El navegador bloqueó la ventana de Spotify.')

  const verifier = randomString(64)
  const state = randomString(16)

  try {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri(),
      code_challenge_method: 'S256',
      code_challenge: await challengeFor(verifier),
      scope: SCOPES,
      state,
    })
    popup.location.replace(`https://accounts.spotify.com/authorize?${params}`)
  } catch (err) {
    popup.close()
    throw err
  }

  const code = await waitForCode(popup, state)

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    client_id: CLIENT_ID,
    code_verifier: verifier,
  })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error_description || 'Spotify rechazó la autorización.')
  }

  // Spotify puede devolver un token con menos permisos de los pedidos. Sin este
  // chequeo el problema aparece más tarde y disfrazado: un 403 al crear la
  // playlist, que se parece a un problema de cuenta y no lo es.
  const granted = String(data.scope || '').split(' ')
  const missing = SCOPES.split(' ').filter(s => !granted.includes(s))
  if (missing.length > 0) {
    throw new Error(
      `Spotify no otorgó ${missing.join(' ni ')} (dio: ${data.scope || 'ninguno'}).`
    )
  }

  return data.access_token as string
}

/**
 * Espera el `code` que la ventana de vuelta manda por `postMessage`.
 *
 * El `state` se compara antes de aceptar nada: es lo que impide que otra página
 * abierta en el navegador nos empuje un código que no pedimos. El origen del
 * mensaje también, porque la ventana de vuelta es una página nuestra.
 */
function waitForCode(popup: Window, state: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const finish = (fn: () => void) => {
      window.removeEventListener('message', onMessage)
      clearInterval(closedTimer)
      fn()
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== SPOTIFY_MESSAGE) return
      if (event.data.state !== state) return

      finish(() => {
        popup.close()
        if (event.data.error) reject(new Error(describeSpotifyError(event.data.error)))
        else if (event.data.code) resolve(event.data.code)
        else reject(new Error('Spotify no devolvió el permiso.'))
      })
    }

    // Cerrar la ventana a mano es una respuesta válida, y no llega ningún
    // mensaje: sin esto la promesa quedaría colgada para siempre.
    const closedTimer = setInterval(() => {
      if (popup.closed) finish(() => reject(new Error('Cancelaste el permiso de Spotify.')))
    }, 500)

    window.addEventListener('message', onMessage)
  })
}

function describeSpotifyError(error: string): string {
  if (error === 'access_denied') return 'No le diste permiso a LetterRock.'
  return `Spotify devolvió un error (${error}).`
}
