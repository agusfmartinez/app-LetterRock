const PROVIDERS = [
  {
    key: 'spotify',
    label: 'Spotify',
    className: 'text-[#1DB954] border-[#1DB954]/40 hover:bg-[#1DB954]/10',
  },
  {
    key: 'youtube',
    label: 'YouTube Music',
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
          className={`inline-flex items-center gap-1 text-xs border rounded-full px-3 py-1 transition-colors ${p.className}`}
        >
          {p.label}
          <span aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  )
}
