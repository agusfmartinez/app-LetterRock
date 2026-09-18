import { IconExternal, IconSpotify, IconYouTubeMusic } from './Icons'

const PROVIDERS = [
  {
    key: 'spotify',
    label: 'Spotify',
    Icon: IconSpotify,
    className: 'text-[#1DB954] border-[#1DB954]/40 hover:bg-[#1DB954]/10',
  },
  {
    key: 'youtube',
    label: 'YouTube Music',
    Icon: IconYouTubeMusic,
    className: 'text-[#FF4E45] border-[#FF4E45]/40 hover:bg-[#FF4E45]/10',
  },
]

/** Búsqueda en YouTube Music, para cuando no hay un link exacto guardado. */
export function youtubeMusicSearch(query) {
  return `https://music.youtube.com/search?q=${encodeURIComponent(query)}`
}

/**
 * Accesos a las plataformas donde está el contenido.
 *
 * `links` son los de `media_links` (exactos). `fallbacks` cubre lo que todavía
 * no está vinculado — por ejemplo un álbum sin playlist de YouTube guardada,
 * que igual se puede resolver con una búsqueda.
 */
export default function PlatformBadges({ links = {}, fallbacks = {}, className = '' }) {
  const available = PROVIDERS
    .map(p => ({ ...p, url: links[p.key]?.url || fallbacks[p.key] || null }))
    .filter(p => p.url)

  if (available.length === 0) return null

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {available.map(p => (
        <a
          key={p.key}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          // El nombre lo dice el logo. Queda en `title` y en `aria-label`: sin
          // texto visible, es lo único que lo nombra para un lector de pantalla.
          title={`Escuchar en ${p.label}`}
          aria-label={`Escuchar en ${p.label}`}
          // `.btn` y no un chip propio: al lado del botón de favorito tienen que
          // medir lo mismo, si no la fila queda escalonada.
          className={`btn !px-4 gap-1.5 ${p.className}`}
        >
          <p.Icon size={18} />
          <IconExternal size={12} />
        </a>
      ))}
    </div>
  )
}
