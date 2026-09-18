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
 * El embed, con su lugar ya ocupado mientras baja.
 *
 * Los dos reproductores tardan unos cuantos milisegundos en aparecer, y hasta
 * entonces el iframe es un hueco transparente: al cambiar de canción el panel
 * quedaba vacío. El armazón va debajo y se apaga cuando el iframe avisa que
 * cargó. La `key` con el `src` lo enciende de nuevo en cada tema.
 */
function Frame({ src, title, height, allow, allowFullScreen = false, className = '' }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative w-full h-full">
      {!loaded && <span className="skeleton absolute inset-0 rounded-xl" aria-hidden="true" />}
      <iframe
        title={title}
        src={src}
        width="100%"
        height={height}
        frameBorder="0"
        loading="lazy"
        allow={allow}
        allowFullScreen={allowFullScreen}
        onLoad={() => setLoaded(true)}
        className={`relative rounded-xl transition-opacity duration-200 ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
      />
    </div>
  )
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
 *
 * `youtube.listId` es el otro caso: una playlist entera, que YouTube incrusta
 * por el path `videoseries` en vez de por un id de video.
 */
export default function MediaEmbed({ spotify, youtube, compact = false, className = '' }) {
  const available = []
  if (spotify?.id) available.push('spotify')
  if (youtube?.videoId || youtube?.listId) available.push('youtube')

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
        <div style={{ height: compact ? 152 : 352 }}>
          <Frame
            key={spotify.id}
            title="Reproductor de Spotify"
            src={`https://open.spotify.com/embed/${spotify.type || 'album'}/${spotify.id}?utm_source=generator&theme=0`}
            height={compact ? 152 : 352}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          />
        </div>
      )}

      {provider === 'youtube' && (
        <div className="aspect-video w-full">
          <Frame
            key={youtube.listId || youtube.videoId}
            title="Reproductor de YouTube"
            src={
              youtube.listId
                ? `https://www.youtube.com/embed/videoseries?list=${youtube.listId}&rel=0`
                : `https://www.youtube.com/embed/${youtube.videoId}?rel=0`
            }
            height="100%"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      )}
    </div>
  )
}
