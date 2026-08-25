import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ManualFieldMark from '../components/common/ManualFieldMark'
import RequireEditor from '../components/common/RequireEditor'
import {
  describeError,
  useAdminArtist,
  useCatalogUpdate,
  useCreateAlbum,
  useReleaseManualField,
  useToggleHidden,
} from '../hooks/useCatalogAdmin'
import { slugify } from '../hooks/useCollectionAdmin'
import { linkArtistDiscography, refreshArtistFromSpotify } from '../services/api'
import { formatReleaseDate } from '../services/dates'

const INPUT = 'bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent'

function Field({ label, field, manualFields, onRelease, children }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-2 text-xs text-gray-500">
        {label}
        <ManualFieldMark field={field} manualFields={manualFields} onRelease={onRelease} />
      </span>
      {children}
    </label>
  )
}

function ArtistForm({ artist }) {
  const update = useCatalogUpdate('artists')
  const release = useReleaseManualField('artists')
  const [form, setForm] = useState({
    name: artist.name || '',
    country: artist.country || '',
    formed_year: artist.formed_year ?? '',
    image_url: artist.image_url || '',
    bio: artist.bio || '',
  })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const set = (key) => (e) => {
    setSaved(false)
    setForm({ ...form, [key]: e.target.value })
  }

  const changed = () => {
    const patch = {}
    if (form.name.trim() !== (artist.name || '')) patch.name = form.name.trim()
    if (form.country.trim() !== (artist.country || '')) patch.country = form.country.trim() || null
    const year = form.formed_year ? Number(form.formed_year) : null
    if (year !== (artist.formed_year ?? null)) patch.formed_year = year
    if (form.image_url.trim() !== (artist.image_url || '')) patch.image_url = form.image_url.trim() || null
    if (form.bio.trim() !== (artist.bio || '')) patch.bio = form.bio.trim() || null
    return patch
  }

  const patch = changed()
  const dirty = Object.keys(patch).length > 0

  const save = () => {
    update.mutate(
      { id: artist.id, manual_fields: artist.manual_fields, ...patch },
      { onSuccess: () => { setError(''); setSaved(true) }, onError: e => setError(describeError(e)) }
    )
  }

  const onRelease = (field) => {
    release.mutate({ id: artist.id, manual_fields: artist.manual_fields, field })
  }

  const marks = { manualFields: artist.manual_fields, onRelease }

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <Field label="Nombre" field="name" {...marks}>
        <input value={form.name} onChange={set('name')} className={`w-full ${INPUT}`} />
      </Field>

      <div className="flex gap-3">
        <Field label="País" field="country" {...marks}>
          <input value={form.country} onChange={set('country')} placeholder="AR" className={`w-20 ${INPUT}`} />
        </Field>
        <Field label="Año de formación" field="formed_year" {...marks}>
          <input value={form.formed_year} onChange={set('formed_year')} type="number" className={`w-28 ${INPUT}`} />
        </Field>
      </div>

      <Field label="URL de imagen" field="image_url" {...marks}>
        <input value={form.image_url} onChange={set('image_url')} className={`w-full ${INPUT}`} />
      </Field>

      <Field label="Biografía" field="bio" {...marks}>
        <textarea value={form.bio} onChange={set('bio')} rows={8} className={`w-full ${INPUT}`} />
      </Field>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || update.isPending}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Guardar
        </button>
        {saved && <span className="text-xs text-gray-500">Guardado</span>}
      </div>
    </div>
  )
}

/**
 * Ocultar en vez de borrar.
 *
 * Borrar la fila no sirve: la búsqueda cae a MusicBrainz cuando no encuentra
 * nada en la DB, y al entrar al resultado el artista se vuelve a crear. El flag
 * queda en la base y sobrevive a cualquier reingesta.
 */
function HiddenToggle({ artist }) {
  const toggle = useToggleHidden('artists')
  const [error, setError] = useState('')

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-2">
      <h2 className="font-bold text-rock-text text-sm">Visibilidad</h2>
      <p className="text-gray-600 text-xs">
        {artist.hidden
          ? 'Oculto: no aparece en búsquedas, ni en la home, ni entre los resultados de MusicBrainz.'
          : 'Visible en toda la app. Ocultalo si no corresponde al catálogo de rock nacional.'}
      </p>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={() => toggle.mutate(
          { id: artist.id, hidden: !artist.hidden },
          { onError: e => setError(describeError(e)) }
        )}
        disabled={toggle.isPending}
        className={`text-xs border rounded px-2 py-1 disabled:opacity-50 ${
          artist.hidden
            ? 'border-rock-accent text-rock-accent'
            : 'border-rock-border text-gray-400 hover:text-red-400 hover:border-red-400'
        }`}
      >
        {artist.hidden ? 'Volver a mostrar' : 'Ocultar del catálogo'}
      </button>
    </div>
  )
}

/** Alta manual, para discos que Spotify no tiene. */
function NewAlbumForm({ artistId }) {
  const create = useCreateAlbum()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    release_date: '',
    release_date_precision: 'year',
    album_type: 'album',
    cover_url: '',
  })
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    create.mutate(
      {
        artist_id: artistId,
        title: form.title.trim(),
        slug: slugify(form.title),
        release_date: form.release_date || null,
        release_date_precision: form.release_date_precision || null,
        album_type: form.album_type,
        cover_url: form.cover_url.trim() || null,
      },
      {
        onSuccess: () => {
          setForm({ title: '', release_date: '', release_date_precision: 'year', album_type: 'album', cover_url: '' })
          setError('')
          setOpen(false)
        },
        onError: e => setError(describeError(e)),
      }
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-gray-500 hover:text-rock-accent">
        + Agregar disco a mano
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <h3 className="font-bold text-rock-text text-sm">Disco nuevo</h3>
      <p className="text-gray-600 text-xs">
        Para discos que Spotify no tiene. Al no llevar id de Spotify, la ingesta
        nunca lo va a modificar.
      </p>
      <input value={form.title} onChange={set('title')} placeholder="Título" className={`w-full ${INPUT}`} />
      <div className="flex gap-2 flex-wrap">
        <input value={form.release_date} onChange={set('release_date')} type="date" className={INPUT} />
        <select value={form.release_date_precision} onChange={set('release_date_precision')} className={INPUT}>
          <option value="year">Sólo el año</option>
          <option value="month">Mes</option>
          <option value="day">Día exacto</option>
        </select>
        <select value={form.album_type} onChange={set('album_type')} className={INPUT}>
          <option value="album">Álbum</option>
          <option value="single">Sencillo / EP</option>
          <option value="compilation">Recopilado</option>
        </select>
      </div>
      <input value={form.cover_url} onChange={set('cover_url')} placeholder="URL de portada (opcional)" className={`w-full ${INPUT}`} />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={create.isPending || !form.title.trim()}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Crear disco
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-rock-text">
          Cancelar
        </button>
      </div>
    </form>
  )
}

/**
 * Refresco de metadatos desde Spotify. La ingesta automática sólo corre cuando
 * el artista no tiene discos, así que sin este botón los ya cargados nunca se
 * actualizan.
 */
function SpotifyRefresh({ artistId }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    setError('')
    setStatus(null)
    try {
      setStatus(await refreshArtistFromSpotify(artistId))
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo conectar con Spotify')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-2">
      <h2 className="font-bold text-rock-text text-sm">Spotify</h2>
      <p className="text-gray-600 text-xs">
        Vuelve a traer título, fecha, precisión de fecha, tipo y portada de todos los
        discos. Los campos que editaste a mano no se tocan.
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-50"
      >
        Refrescar metadatos
      </button>

      {busy && <p className="text-gray-500 text-xs">Consultando Spotify...</p>}
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {status && (
        <div className="text-xs space-y-1">
          <p className="text-gray-400">{status.saved} de {status.total} discos actualizados</p>
          {status.errors?.map(e => <p key={e} className="text-gray-600">{e}</p>)}
        </div>
      )}
    </div>
  )
}

function YoutubeDiscography({ artistId }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    setError('')
    setStatus(null)
    try {
      setStatus(await linkArtistDiscography(artistId))
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo conectar con YouTube')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-2">
      <h2 className="font-bold text-rock-text text-sm">YouTube Music</h2>
      <p className="text-gray-600 text-xs">
        Busca el canal del artista y vincula todos sus discos de una. Los tracklists que
        falten se traen de Spotify en el momento.
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-50"
      >
        Vincular discografía
      </button>

      {busy && <p className="text-gray-500 text-xs">Consultando YouTube...</p>}
      {error && <p className="text-red-400 text-xs">{error}</p>}

      {status && (
        <div className="text-xs space-y-1">
          {status.skipped ? (
            <p className="text-gray-400">No se pudo: {status.skipped}</p>
          ) : (
            <>
              <p className="text-gray-400">
                {status.albums?.filter(a => a.matched).length} de {status.albums?.length} álbumes vinculados
              </p>
              {status.albums?.filter(a => a.skipped).map(a => (
                <p key={a.album} className="text-gray-600">{a.album}: {a.skipped}</p>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function AlbumRow({ album }) {
  const toggle = useToggleHidden('albums')

  return (
    <div className="flex items-center gap-3 p-3">
      <div className={`w-10 h-10 rounded overflow-hidden bg-rock-dark flex-shrink-0 ${album.hidden ? 'opacity-40' : ''}`}>
        {album.cover_url ? (
          <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm">💿</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <Link
          to={`/admin/album/${album.id}`}
          className={`hover:text-rock-accent ${album.hidden ? 'text-gray-600 line-through' : 'text-rock-text'}`}
        >
          {album.title}
        </Link>
        <p className="text-gray-500 text-xs">
          {album.album_type} · {formatReleaseDate(album) || 'sin fecha'}
          {album.manual_fields?.length > 0 && (
            <span className="text-rock-accent"> · editado</span>
          )}
          {album.hidden && <span className="text-red-400"> · oculto</span>}
        </p>
      </div>
      <button
        onClick={() => toggle.mutate({ id: album.id, hidden: !album.hidden })}
        disabled={toggle.isPending}
        title={album.hidden ? 'Volver a mostrarlo' : 'Ocultar de la discografía'}
        className="text-xs text-gray-500 hover:text-rock-accent disabled:opacity-50"
      >
        {album.hidden ? 'Mostrar' : 'Ocultar'}
      </button>
      <Link
        to={`/admin/album/${album.id}`}
        className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent"
      >
        Editar
      </Link>
      <Link
        to={`/album/${album.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-500 hover:text-rock-accent text-sm"
      >
        Ver →
      </Link>
    </div>
  )
}

export default function AdminArtistEdit() {
  const { id } = useParams()
  const { data, isLoading } = useAdminArtist(id)

  return (
    <RequireEditor>
      {isLoading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : !data ? (
        <p className="text-red-400">Artista no encontrado.</p>
      ) : (
        <div className="space-y-6 max-w-3xl">
          <div className="flex items-center gap-4 flex-wrap">
            <Link to="/admin/catalogo" className="text-gray-400 hover:text-rock-accent text-sm">
              ← Catálogo
            </Link>
            <Link
              to={`/artist/${data.artist.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-rock-accent text-sm ml-auto"
            >
              Ver la página →
            </Link>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-rock-text">{data.artist.name}</h1>
            {data.artist.hidden && (
              <span className="text-xs uppercase tracking-widest border border-red-400 text-red-400 rounded px-2 py-0.5">
                Oculto
              </span>
            )}
          </div>

          <ArtistForm key={data.artist.id} artist={data.artist} />

          <HiddenToggle artist={data.artist} />

          <SpotifyRefresh artistId={data.artist.id} />

          <YoutubeDiscography artistId={data.artist.id} />

          <div>
            <h2 className="text-lg font-bold text-rock-text mb-3">
              Discos ({data.albums.length})
            </h2>
            {data.albums.length === 0 ? (
              <p className="text-gray-500 text-sm">Sin discos cargados.</p>
            ) : (
              <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border mb-4">
                {data.albums.map(a => <AlbumRow key={a.id} album={a} />)}
              </div>
            )}

            <NewAlbumForm artistId={data.artist.id} />
          </div>
        </div>
      )}
    </RequireEditor>
  )
}
