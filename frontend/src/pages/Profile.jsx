import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AlbumCard from '../components/common/AlbumCard'
import ArtistCard from '../components/common/ArtistCard'
import ReviewCard from '../components/common/ReviewCard'
import { useUserFavorites } from '../hooks/useFavorite'
import { supabase } from '../services/supabaseClient'

const FAV_FILTERS = [
  { value: 'all', label: 'Todo' },
  { value: 'artist', label: 'Artistas' },
  { value: 'album', label: 'Álbumes' },
  { value: 'track', label: 'Canciones' },
]

function formatDuration(ms) {
  if (!ms) return '—'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

function FavoriteTrackRow({ track }) {
  return (
    <Link
      to={`/track/${track.id}`}
      className="flex items-center gap-3 px-3 py-2 rounded hover:bg-rock-dark transition-colors"
    >
      <div className="w-10 h-10 rounded overflow-hidden bg-rock-dark flex-shrink-0">
        {track.album?.cover_url ? (
          <img src={track.album.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm">💿</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-rock-text truncate">{track.title}</p>
        {track.album?.title && (
          <p className="text-gray-500 text-xs truncate">{track.album.title}</p>
        )}
      </div>
      <span className="text-gray-500 text-sm flex-shrink-0">{formatDuration(track.duration_ms)}</span>
    </Link>
  )
}

export default function Profile() {
  const { username } = useParams()
  const [tab, setTab] = useState('reviews')
  const [favFilter, setFavFilter] = useState('all')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single()
      return data
    },
  })

  const { data: reviews = [] } = useQuery({
    queryKey: ['profile-reviews', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('reviews')
        .select('*, user:users(username, avatar_url)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20)
      return data || []
    },
    enabled: !!profile?.id,
  })

  const { data: favorites = [], isLoading: loadingFavorites } = useUserFavorites(profile?.id)

  if (isLoading) return <p className="text-gray-500">Cargando...</p>
  if (!profile) return <p className="text-red-400">Usuario no encontrado.</p>

  const visibleFavorites = favorites.filter(
    f => f.entity && (favFilter === 'all' || f.entity_type === favFilter)
  )
  const favArtists = visibleFavorites.filter(f => f.entity_type === 'artist')
  const favAlbums = visibleFavorites.filter(f => f.entity_type === 'album')
  const favTracks = visibleFavorites.filter(f => f.entity_type === 'track')

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Avatar + info */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-rock-accent flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          {profile.username[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-rock-text">{profile.username}</h1>
          {profile.bio && <p className="text-gray-400 text-sm mt-1">{profile.bio}</p>}
          <p className="text-gray-500 text-xs mt-1">
            {reviews.length} opiniones · {favorites.length} favoritos
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-rock-border">
        {['reviews', 'favoritos'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-rock-accent text-rock-text'
                : 'border-transparent text-gray-500 hover:text-rock-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'reviews' && (
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin opiniones aún.</p>
          ) : (
            reviews.map(r => <ReviewCard key={r.id} review={r} />)
          )}
        </div>
      )}

      {tab === 'favoritos' && (
        <div className="space-y-6">
          <div className="flex gap-1 bg-rock-card border border-rock-border rounded-lg p-1 w-fit">
            {FAV_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFavFilter(value)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  favFilter === value
                    ? 'bg-rock-accent text-black font-semibold'
                    : 'text-gray-400 hover:text-rock-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loadingFavorites ? (
            <p className="text-gray-500 text-sm">Cargando favoritos...</p>
          ) : visibleFavorites.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin favoritos aún.</p>
          ) : (
            <>
              {favArtists.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Artistas</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {favArtists.map(f => <ArtistCard key={f.id} artist={f.entity} />)}
                  </div>
                </section>
              )}

              {favAlbums.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Álbumes</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {favAlbums.map(f => <AlbumCard key={f.id} album={f.entity} />)}
                  </div>
                </section>
              )}

              {favTracks.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Canciones</h2>
                  <div className="bg-rock-card border border-rock-border rounded-lg py-2">
                    {favTracks.map(f => <FavoriteTrackRow key={f.id} track={f.entity} />)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
