/**
 * Reproductor de Spotify. Sale del `external_spotify_id` que ya guarda la ingesta,
 * así que no necesita API key ni token.
 */
export default function SpotifyEmbed({ spotifyId, type = 'album', compact = false }) {
  if (!spotifyId) return null

  return (
    <iframe
      title="Reproductor de Spotify"
      src={`https://open.spotify.com/embed/${type}/${spotifyId}?utm_source=generator&theme=0`}
      width="100%"
      height={compact ? 152 : 352}
      frameBorder="0"
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      className="rounded-xl border border-rock-border"
    />
  )
}
