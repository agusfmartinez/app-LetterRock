import { useEffect, useState } from 'react'
import { SPOTIFY_MESSAGE } from '../services/spotifyAuth'

/**
 * La vuelta de Spotify, dentro de la ventana de permisos.
 *
 * No es una página para mirar: recibe el código, se lo pasa a la ventana que la
 * abrió y se cierra. El intercambio por el token pasa allá y no acá porque el
 * `code_verifier` de PKCE vive en la función que pidió el permiso; mandarlo a
 * esta ventana sería pasearlo de más sin ninguna ganancia.
 *
 * El `postMessage` va dirigido a nuestro propio origen, no a `*`: el mensaje
 * lleva un código de autorización de la cuenta de Spotify de quien está usando
 * la app, y ninguna otra página tiene por qué poder leerlo.
 */
export default function SpotifyCallback() {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const payload = {
      type: SPOTIFY_MESSAGE,
      code: params.get('code'),
      state: params.get('state'),
      error: params.get('error'),
    }

    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin)
      window.close()
      // Si el navegador no deja cerrar una ventana abierta por script, al menos
      // que diga qué pasó en vez de quedar en blanco.
      setTimeout(() => setStuck(true), 800)
    } else {
      setStuck(true)
    }
  }, [])

  return (
    <div className="py-16 grid place-items-center">
      <div className="w-full max-w-[420px] rounded-xl overflow-hidden bg-rock-card shadow-card-hover">
        {/* La barra de una ventana: dice que esto es una ventana aparte y no
            una página del sitio, que es justo lo que confunde cuando queda
            abierta. */}
        <div className="flex items-center gap-2 px-4 py-3 bg-rock-border">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-600" />
          <span className="w-2.5 h-2.5 rounded-full bg-gray-600" />
          <span className="w-2.5 h-2.5 rounded-full bg-gray-600" />
          <span className="ml-2 font-mono text-[11px] text-gray-500 truncate">
            letterrock.app/spotify-callback
          </span>
        </div>

        <div className="px-7 py-14 text-center">
          {!stuck && (
            <span
              aria-hidden="true"
              className="inline-block w-7 h-7 rounded-full border-[3px] border-rock-border
                         border-t-rock-accent animate-spin"
              style={{ animationDuration: '0.9s' }}
            />
          )}
          <p className="text-[15px] text-gray-300 mt-4">
            {stuck ? 'Listo. Podés cerrar esta ventana.' : 'Conectando con Spotify…'}
          </p>
        </div>
      </div>
    </div>
  )
}
