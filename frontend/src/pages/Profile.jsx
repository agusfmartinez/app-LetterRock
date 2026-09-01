import { useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AlbumCard from '../components/common/AlbumCard'
import ArtistCard from '../components/common/ArtistCard'
import ReviewCard from '../components/common/ReviewCard'
import { CollectionCard } from './Collections'
import { useUserCollections } from '../hooks/useCollections'
import { useUserFavorites } from '../hooks/useFavorite'
import { fetchEntities } from '../services/entities'
import FollowButton from '../components/common/FollowButton'
import { useFollow, useUserProfiles } from '../hooks/useFollows'
import { ROLE_LABEL } from '../hooks/useRole'
import { ACCEPTED_IMAGE_TYPES, avatarFolder, uploadImage } from '../services/storage'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'

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

/**
 * Foto de perfil. Sólo la ve como editable el dueño del perfil.
 *
 * La subida va a `avatars/<uid>/`: la policy de Storage compara ese segmento con
 * `auth.uid()`, así que el path no es cosmético, es lo que impide que alguien
 * pise la foto de otro.
 */
function Avatar({ profile, isOwn }) {
  const queryClient = useQueryClient()
  const setUser = useAuthStore(s => s.setUser)
  const user = useAuthStore(s => s.user)
  const [error, setError] = useState('')

  const save = async (url) => {
    setError('')
    const { error: dbError } = await supabase
      .from('users')
      .update({ avatar_url: url || null })
      .eq('id', profile.id)

    if (dbError) {
      setError(dbError.message)
      return
    }

    // El avatar viaja en el store de sesión y embebido en cada review y cada
    // ítem del feed, así que no alcanza con refrescar el perfil.
    // Las reviews de artista/álbum no están en React Query (useReviews maneja su
    // propio estado) y se rearman solas al volver a entrar.
    if (user?.id === profile.id) setUser({ ...user, avatar_url: url || null })
    for (const key of ['profile', 'profile-reviews', 'activity-feed']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <div className="w-16 h-16 rounded-full overflow-hidden bg-rock-accent flex items-center justify-center text-white text-2xl font-bold">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
        ) : (
          profile.username[0].toUpperCase()
        )}
      </div>

      {isOwn && (
        <>
          <AvatarUpload onUploaded={save} hasAvatar={!!profile.avatar_url} onClear={() => save('')} />
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </>
      )}
    </div>
  )
}

function AvatarUpload({ onUploaded, hasAvatar, onClear }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const user = useAuthStore(s => s.user)

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await onUploaded(await uploadImage(file, avatarFolder(user.id)))
    } catch (err) {
      setError(err.message || 'No se pudo subir la imagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-50"
      >
        {busy ? 'Subiendo...' : hasAvatar ? 'Cambiar foto' : 'Subir foto'}
      </button>
      {hasAvatar && (
        <button onClick={onClear} className="text-gray-500 hover:text-red-400">
          Quitar
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        onChange={pick}
        className="hidden"
      />
      {error && <span className="text-red-400">{error}</span>}
    </div>
  )
}

/**
 * Seguidores o seguidos, como filas clickeables.
 *
 * Los ids salen de `follows` y los perfiles de una segunda consulta: la tabla
 * tiene dos claves foráneas a `users` y PostgREST no adivina cuál embeber.
 */
function UserList({ ids, empty }) {
  const { data: users = [], isLoading } = useUserProfiles(ids)

  if (ids.length === 0) return <p className="text-gray-500 text-sm">{empty}</p>
  if (isLoading) return <p className="text-gray-500 text-sm">Cargando...</p>

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
      {users.map(u => (
        <div key={u.id} className="flex items-center gap-3 p-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-rock-accent flex items-center justify-center text-white font-bold flex-shrink-0">
            {u.avatar_url ? (
              <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
            ) : (
              u.username[0].toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <Link to={`/user/${u.username}`} className="text-rock-text font-medium hover:text-rock-accent">
              {u.username}
            </Link>
            {u.bio && <p className="text-gray-500 text-xs truncate">{u.bio}</p>}
          </div>
          <FollowButton userId={u.id} />
        </div>
      ))}
    </div>
  )
}

/**
 * Edición del propio perfil: nombre de usuario y bio.
 *
 * La bio ya se mostraba en el perfil, en el buscador y en las listas de
 * seguidores, pero no había ninguna pantalla donde escribirla. El nombre entra
 * acá porque el que se elige al registrarse es el único que se tenía, para
 * siempre.
 */
function EditProfile({ profile, onClose }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setUser = useAuthStore(s => s.setUser)
  const user = useAuthStore(s => s.user)

  const [username, setUsername] = useState(profile.username)
  const [bio, setBio] = useState(profile.bio || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const cleanName = username.trim()
  const dirty = cleanName !== profile.username || bio.trim() !== (profile.bio || '')

  const save = async () => {
    if (!cleanName) {
      setError('El nombre de usuario no puede quedar vacío.')
      return
    }
    setBusy(true)
    setError('')

    const { error: dbError } = await supabase
      .from('users')
      .update({ username: cleanName, bio: bio.trim() || null })
      .eq('id', profile.id)

    setBusy(false)

    if (dbError) {
      // 23505 es la violación del índice único de username: es el único error
      // que el usuario puede provocar y arreglar por su cuenta.
      setError(
        dbError.code === '23505'
          ? 'Ese nombre de usuario ya está tomado.'
          : dbError.message
      )
      return
    }

    setUser({ ...user, username: cleanName, bio: bio.trim() || null })
    queryClient.invalidateQueries({ queryKey: ['profile'] })
    queryClient.invalidateQueries({ queryKey: ['user-profiles'] })
    queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
    onClose()

    // La URL del perfil lleva el nombre adentro: sin esto queda apuntando a uno
    // que ya no existe y la próxima recarga da "usuario no encontrado".
    if (cleanName !== profile.username) navigate(`/user/${cleanName}`, { replace: true })
  }

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <label className="block space-y-1">
        <span className="text-xs text-gray-500">Nombre de usuario</span>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text focus:outline-none focus:border-rock-accent"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-gray-500">Bio</span>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          rows={3}
          placeholder="Contá qué escuchás."
          className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
        />
      </label>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-rock-text">
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function Profile() {
  const { username } = useParams()
  const [tab, setTab] = useState('reviews')
  const [favFilter, setFavFilter] = useState('all')
  const [editing, setEditing] = useState(false)
  const sessionUser = useAuthStore(s => s.user)

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

      // Sobre qué opinó. En una ficha de álbum se sabe por la página; acá cada
      // opinión es de otra cosa, así que hay que resolverlas: una consulta por
      // tipo, no una por review.
      const rows = data || []
      const byId = await fetchEntities(rows)
      return rows.map(r => ({ ...r, entity: byId.get(r.entity_id) || null }))
    },
    enabled: !!profile?.id,
  })

  const { data: favorites = [], isLoading: loadingFavorites } = useUserFavorites(profile?.id)
  const follow = useFollow(profile?.id)
  const { data: collections = [] } = useUserCollections(profile?.id)

  if (isLoading) return <p className="text-gray-500">Cargando...</p>
  if (!profile) return <p className="text-red-400">Usuario no encontrado.</p>

  const visibleFavorites = favorites.filter(
    f => f.entity && (favFilter === 'all' || f.entity_type === favFilter)
  )
  const favArtists = visibleFavorites.filter(f => f.entity_type === 'artist')
  const favAlbums = visibleFavorites.filter(f => f.entity_type === 'album')
  const favTracks = visibleFavorites.filter(f => f.entity_type === 'track')
  const isOwn = sessionUser?.id === profile.id

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Avatar + info */}
      <div className="flex items-start gap-4">
        <Avatar profile={profile} isOwn={isOwn} />
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-rock-text">{profile.username}</h1>
            {profile.role && profile.role !== 'user' && (
              <span className="text-xs uppercase tracking-widest px-2 py-0.5 rounded border border-rock-accent text-rock-accent">
                {ROLE_LABEL[profile.role]}
              </span>
            )}
            <FollowButton userId={profile.id} />
            {isOwn && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent"
              >
                Editar perfil
              </button>
            )}
          </div>
          {profile.bio && <p className="text-gray-400 text-sm mt-1">{profile.bio}</p>}
          <p className="text-gray-500 text-xs mt-1">
            {reviews.length} opiniones · {favorites.length} favoritos ·{' '}
            {collections.length} {collections.length === 1 ? 'colección' : 'colecciones'} ·{' '}
            <button
              onClick={() => setTab('seguidores')}
              className="hover:text-rock-accent"
            >
              {follow.followerCount} {follow.followerCount === 1 ? 'seguidor' : 'seguidores'}
            </button>
            {' · '}
            <button onClick={() => setTab('siguiendo')} className="hover:text-rock-accent">
              {follow.followingCount} siguiendo
            </button>
          </p>
        </div>
      </div>

      {isOwn && editing && (
        <EditProfile
          key={profile.username}
          profile={profile}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-rock-border">
        {['reviews', 'favoritos', 'colecciones', 'seguidores', 'siguiendo'].map(t => (
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
            reviews.map(r => <ReviewCard key={r.id} review={r} showEntity />)
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

      {tab === 'colecciones' && (
        collections.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {isOwn ? (
              <>
                Todavía no armaste ninguna.{' '}
                <Link to="/colecciones" className="text-rock-accent hover:underline">
                  Armá la primera →
                </Link>
              </>
            ) : (
              'Todavía no armó ninguna.'
            )}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {collections.map(c => <CollectionCard key={c.id} collection={c} />)}
          </div>
        )
      )}

      {tab === 'seguidores' && (
        <UserList
          ids={follow.followerIds}
          empty={follow.isSelf ? 'Todavía no te sigue nadie.' : 'Todavía no lo sigue nadie.'}
        />
      )}

      {tab === 'siguiendo' && (
        <UserList
          ids={follow.followingIds}
          empty={follow.isSelf ? 'Todavía no seguís a nadie.' : 'Todavía no sigue a nadie.'}
        />
      )}
    </div>
  )
}
