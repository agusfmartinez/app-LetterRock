import { useEffect, useState } from 'react'

const PLAYER_KEY = 'letterrock:player'

const LABELS = {
  spotify: 'Spotify',
  youtube: 'YouTube',
}

/**
 * Preferencia de reproductor del visitante. En un try/catch porque en modo
 * privado o con las cookies bloqueadas el acceso a localStorage tira excepción.
 */
function readPreference() {
  try {
    return localStorage.getItem(PLAYER_KEY)
  } catch {
    return null
  }
}

function writePreference(value) {
  try {
    localStorage.setItem(PLAYER_KEY, value)
  } catch {
    // sin persistencia, la elección dura lo que dure la página
  }
}

/**
 * Reproductor de la plataforma que elija quien mira.
 *
 * Ninguno de los dos embeds se puede modificar por dentro: son la UI de cada
 * servicio. Lo que sí se controla es cuál se monta, y eso queda guardado por
 * visitante.
 *
 * YouTube Music no tiene embed propio: lo único incrustable es el reproductor
 * de video de YouTube, así que esa pestaña siempre muestra video.
 *
 * No se encadenan los videos del álbum con `?playlist=`: en la práctica el embed
 * arranca por el primer id de esa lista y no por el del path, así que terminaba
 * empezando por la pista 2. Sin encadenar arranca donde corresponde, a cambio de
 * perder el avance automático.
 */
export default function MediaEmbed({ spotify, youtube, compact = false, className = '' }) {
  const available = []
  if (spotify?.id) available.push('spotify')
  if (youtube?.videoId) available.push('youtube')

  const [provider, setProvider] = useState(() => {
    const preferred = readPreference()
    return preferred && available.includes(preferred) ? preferred : available[0] || null
  })

  // Los links llegan por fetch, así que la lista de plataformas puede aparecer
  // después del primer render.
  useEffect(() => {
    if (available.length === 0) return
    if (provider && available.includes(provider)) return
    const preferred = readPreference()
    setProvider(preferred && available.includes(preferred) ? preferred : available[0])
  }, [available.join(','), provider])

  if (!provider) return null

  const choose = (value) => {
    setProvider(value)
    writePreference(value)
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {available.length > 1 && (
        <div className="flex items-center gap-1">
          {available.map(key => (
            <button
              key={key}
              onClick={() => choose(key)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                provider === key
                  ? 'bg-rock-accent/15 text-rock-accent font-semibold'
                  : 'text-gray-500 hover:text-rock-text'
              }`}
            >
              {LABELS[key]}
            </button>
          ))}
        </div>
      )}

      {provider === 'spotify' && (
        <iframe
          title="Reproductor de Spotify"
          src={`https://open.spotify.com/embed/${spotify.type || 'album'}/${spotify.id}?utm_source=generator&theme=0`}
          width="100%"
          height={compact ? 152 : 352}
          frameBorder="0"
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className="rounded-xl"
        />
      )}

      {provider === 'youtube' && (
        <div className="aspect-video w-full">
          <iframe
            title="Reproductor de YouTube"
            src={`https://www.youtube.com/embed/${youtube.videoId}?rel=0`}
            width="100%"
            height="100%"
            frameBorder="0"
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="rounded-xl w-full h-full"
          />
        </div>
      )}
    </div>
  )
}
