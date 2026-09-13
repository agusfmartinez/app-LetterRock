import { useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AlbumCard from '../components/common/AlbumCard'
import ArtistCard from '../components/common/ArtistCard'
import ReviewCard from '../components/common/ReviewCard'
import { CollectionCard } from './Collections'
import { useUserCollections } from '../hooks/useCollections'
import { useUserPosts } from '../hooks/usePosts'
import ActivityItem from '../components/common/ActivityItem'
import { useUserFavorites } from '../hooks/useFavorite'
import { fetchEntities } from '../services/entities'
import FollowButton from '../components/common/FollowButton'
import { EmptyState, NotFoundLine, SkeletonFicha, SkeletonGrid, SkeletonRows } from '../components/common/States'
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
      className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-rock-card transition-colors"
    >
      <div className="w-10 h-10 rounded overflow-hidden bg-rock-border flex-none grid place-items-center">
        {track.album?.cover_url ? (
          <img src={track.album.cover_url} alt="" className="w-full h-full object-cover washed" />
        ) : (
          <span className="font-display text-sm text-gray-500">{track.title?.[0]?.toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate">{track.title}</p>
        {track.album?.title && (
          <p className="text-gray-500 text-xs truncate">{track.album.title}</p>
        )}
      </div>
      <span className="text-gray-500 text-sm flex-none tabular-nums">{formatDuration(track.duration_ms)}</span>
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
    <div className="flex flex-col items-center gap-2.5 flex-none">
      <div className="w-[104px] h-[104px] rounded-full overflow-hidden bg-rock-accent/20
                      border border-rock-accentDim grid place-items-center
                      font-display text-4xl text-rock-accentBright">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
        ) : (
          profile.username[0].toUpperCase()
        )}
      </div>

      {isOwn && (
        <>
          <AvatarUpload onUploaded={save} hasAvatar={!!profile.avatar_url} onClear={() => save('')} />
          {error && <p className="text-rock-accentBright text-xs">{error}</p>}
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
        className="btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px]"
      >
        {busy ? 'Subiendo...' : hasAvatar ? 'Cambiar foto' : 'Subir foto'}
      </button>
      {hasAvatar && (
        <button onClick={onClear} className="text-gray-500 hover:text-rock-accentBright">
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
      {error && <span className="text-rock-accentBright">{error}</span>}
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

  if (isLoading) return <SkeletonRows count={3} />
  if (ids.length === 0) return <EmptyState>{empty}</EmptyState>

  return (
    <div className="flex flex-col gap-2.5 max-w-[620px]">
      {users.map(u => (
        <div key={u.id} className="flex items-center gap-3.5 card !py-3">
          <div className="w-10 h-10 flex-none rounded-full overflow-hidden bg-rock-accent/20
                          border border-rock-accentDim grid place-items-center
                          text-rock-accentBright font-bold">
            {u.avatar_url ? (
              <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
            ) : (
              u.username[0].toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <Link to={`/user/${u.username}`} className="font-medium hover:text-rock-accent">
              {u.username}
            </Link>
            {u.bio && <p className="text-gray-500 text-[12.5px] truncate">{u.bio}</p>}
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
    <div className="card max-w-[560px] space-y-4">
      <p className="font-mono text-[9.5px] tracking-[0.16em] text-gray-500">EDITAR PERFIL</p>

      <div className="field">
        <label htmlFor="lr-pname">Nombre de usuario</label>
        <input
          id="lr-pname"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className={`input ${error ? 'border-rock-accent' : ''}`}
        />
      </div>

      <div className="field">
        <label htmlFor="lr-pbio">Bio</label>
        <textarea
          id="lr-pbio"
          value={bio}
          onChange={e => setBio(e.target.value)}
          rows={3}
          placeholder="Contá qué escuchás."
          className="input"
        />
      </div>

      {error && <p className="field-error">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="btn btn-primary"
        >
          {busy ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={onClose} className="btn btn-secondary">
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
  const { data: posts = [] } = useUserPosts(profile?.id)

  if (isLoading) return <div className="py-11"><SkeletonFicha lines={4} /></div>
  if (!profile) return <NotFoundLine>Usuario no encontrado.</NotFoundLine>

  const visibleFavorites = favorites.filter(
    f => f.entity && (favFilter === 'all' || f.entity_type === favFilter)
  )
  const favArtists = visibleFavorites.filter(f => f.entity_type === 'artist')
  const favAlbums = visibleFavorites.filter(f => f.entity_type === 'album')
  const favTracks = visibleFavorites.filter(f => f.entity_type === 'track')
  const isOwn = sessionUser?.id === profile.id

  return (
    <div className="animate-fade-up">
      {/* — Ficha — */}
      <div className="flex flex-wrap items-start gap-7 py-9">
        <Avatar profile={profile} isOwn={isOwn} />

        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h1 className="text-screen">{profile.username}</h1>
            {profile.role && profile.role !== 'user' && (
              <span className="tag tag-accent">{ROLE_LABEL[profile.role]}</span>
            )}
          </div>

          {profile.bio && (
            <p className="text-[15.5px] leading-relaxed text-gray-300 max-w-[54ch] mb-2.5">
              {profile.bio}
            </p>
          )}

          {/* Los contadores son navegación: cada uno lleva a la solapa que lo
              explica, así que seguidores y siguiendo son botones de verdad. */}
          <p className="text-[13.5px] text-gray-500 mb-4">
            {posts.length} {posts.length === 1 ? 'posteo' : 'posteos'} ·{' '}
            {reviews.length} opiniones · {favorites.length} favoritos ·{' '}
            {collections.length} {collections.length === 1 ? 'colección' : 'colecciones'} ·{' '}
            <button onClick={() => setTab('seguidores')} className="hover:text-rock-accent">
              {follow.followerCount} {follow.followerCount === 1 ? 'seguidor' : 'seguidores'}
            </button>
            {' · '}
            <button onClick={() => setTab('siguiendo')} className="hover:text-rock-accent">
              {follow.followingCount} siguiendo
            </button>
          </p>

          <div className="flex gap-2 flex-wrap">
            <FollowButton userId={profile.id} />
            {isOwn && !editing && (
              <button onClick={() => setEditing(true)} className="btn btn-secondary">
                Editar perfil
              </button>
            )}
          </div>
        </div>
      </div>

      {isOwn && editing && (
        <EditProfile
          key={profile.username}
          profile={profile}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Las solapas scrollean en horizontal antes que envolver a dos
          líneas: en un teléfono son seis y no entran. */}
      <div className="tab-rail border-b border-rock-border mb-7">
        {['posteos', 'reviews', 'favoritos', 'colecciones', 'seguidores', 'siguiendo'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tab capitalize ${tab === t ? 'tab-active' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Se reusa la fila del feed en vez de una tarjeta propia: es el mismo
          posteo, y dos maquetas para lo mismo se despegan con el tiempo. */}
      {tab === 'posteos' && (
        <div className="max-w-2xl">
          {posts.length === 0 ? (
            <EmptyState title="Sin posteos">
              {isOwn ? 'Todavía no escribiste nada en el feed.' : 'Todavía no escribió nada.'}
            </EmptyState>
          ) : (
            <div>
              {posts.map(p => (
                <ActivityItem
                  key={p.id}
                  activity={{ ...p, kind: 'post', text: p.body }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <EmptyState title="Sin opiniones">
              {isOwn ? 'Todavía no puntuaste nada.' : 'Todavía no puntuó nada.'}
            </EmptyState>
          ) : (
            reviews.map(r => <ReviewCard key={r.id} review={r} showEntity />)
          )}
        </div>
      )}

      {tab === 'favoritos' && (
        <div className="space-y-6">
          <div className="seg">
            {FAV_FILTERS.map(({ value, label }) => (
              <label key={value} className="seg-opt">
                <input
                  type="radio"
                  name="fav-filter"
                  checked={favFilter === value}
                  onChange={() => setFavFilter(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {loadingFavorites ? (
            <SkeletonGrid count={4} min={150} />
          ) : visibleFavorites.length === 0 ? (
            <EmptyState title="Sin favoritos">
              {favFilter === 'all'
                ? (isOwn ? 'Guardá lo que no querés perder de vista.' : 'Todavía no guardó nada.')
                : 'Nada guardado de este tipo.'}
            </EmptyState>
          ) : (
            <>
              {favArtists.length > 0 && (
                <section>
                  <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 mb-4">ARTISTAS</p>
                  <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>
                    {favArtists.map(f => <ArtistCard key={f.id} artist={f.entity} variant="circle" />)}
                  </div>
                </section>
              )}

              {favAlbums.length > 0 && (
                <section>
                  <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 mb-4">ÁLBUMES</p>
                  <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(168px,1fr))' }}>
                    {favAlbums.map(f => <AlbumCard key={f.id} album={f.entity} />)}
                  </div>
                </section>
              )}

              {favTracks.length > 0 && (
                <section>
                  <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 mb-4">CANCIONES</p>
                  <div className="card !p-2 max-w-2xl">
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
          <EmptyState
            title="Sin colecciones"
            action={isOwn && (
              <Link to="/colecciones" className="btn btn-secondary">Armar la primera</Link>
            )}
          >
            {isOwn
              ? 'Un recorrido propio: elegí discos y ordenalos como quieras.'
              : 'Todavía no armó ninguna.'}
          </EmptyState>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
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
