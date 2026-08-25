import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ManualFieldMark from '../components/common/ManualFieldMark'
import RequireEditor from '../components/common/RequireEditor'
import {
  describeError,
  useAdminAlbum,
  useCatalogUpdate,
  useCreateTrack,
  useDeleteTrack,
  useReleaseManualField,
} from '../hooks/useCatalogAdmin'
import { useRole } from '../hooks/useRole'
import { formatReleaseDate } from '../services/dates'

const INPUT = 'bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent'

const PRECISIONS = [
  { value: '', label: 'Sin definir' },
  { value: 'day', label: 'Día exacto' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Sólo el año' },
]

function Field({ label, field, manualFields, onRelease, hint, children }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-2 text-xs text-gray-500">
        {label}
        <ManualFieldMark field={field} manualFields={manualFields} onRelease={onRelease} />
      </span>
      {children}
      {hint && <span className="block text-[11px] text-gray-600">{hint}</span>}
    </label>
  )
}

function AlbumForm({ album }) {
  const update = useCatalogUpdate('albums')
  const release = useReleaseManualField('albums')
  const [form, setForm] = useState({
    title: album.title || '',
    release_date: album.release_date || '',
    release_date_precision: album.release_date_precision || '',
    album_type: album.album_type || '',
    cover_url: album.cover_url || '',
    description: album.description || '',
  })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const set = (key) => (e) => {
    setSaved(false)
    setForm({ ...form, [key]: e.target.value })
  }

  const patch = {}
  if (form.title.trim() !== (album.title || '')) patch.title = form.title.trim()
  if (form.release_date !== (album.release_date || '')) patch.release_date = form.release_date || null
  if (form.release_date_precision !== (album.release_date_precision || '')) {
    patch.release_date_precision = form.release_date_precision || null
  }
  if (form.album_type !== (album.album_type || '')) patch.album_type = form.album_type || null
  if (form.cover_url.trim() !== (album.cover_url || '')) patch.cover_url = form.cover_url.trim() || null
  if (form.description.trim() !== (album.description || '')) patch.description = form.description.trim() || null

  const dirty = Object.keys(patch).length > 0

  const save = () => {
    update.mutate(
      { id: album.id, manual_fields: album.manual_fields, ...patch },
      { onSuccess: () => { setError(''); setSaved(true) }, onError: e => setError(describeError(e)) }
    )
  }

  const onRelease = (field) => {
    release.mutate({ id: album.id, manual_fields: album.manual_fields, field })
  }

  const marks = { manualFields: album.manual_fields, onRelease }

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <Field label="Título" field="title" {...marks}>
        <input value={form.title} onChange={set('title')} className={`w-full ${INPUT}`} />
      </Field>

      <div className="flex gap-3 flex-wrap">
        <Field
          label="Fecha de edición"
          field="release_date"
          {...marks}
          hint={`Se muestra como: ${formatReleaseDate({ ...album, ...form }) || '—'}`}
        >
          <input value={form.release_date} onChange={set('release_date')} type="date" className={INPUT} />
        </Field>

        <Field label="Precisión" field="release_date_precision" {...marks}>
          <select
            value={form.release_date_precision}
            onChange={set('release_date_precision')}
            className={INPUT}
          >
            {PRECISIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>

        <Field label="Tipo" field="album_type" {...marks}>
          <select value={form.album_type} onChange={set('album_type')} className={INPUT}>
            <option value="album">Álbum</option>
            <option value="single">Sencillo / EP</option>
            <option value="compilation">Recopilado</option>
          </select>
        </Field>
      </div>

      <Field label="URL de portada" field="cover_url" {...marks}>
        <input value={form.cover_url} onChange={set('cover_url')} className={`w-full ${INPUT}`} />
      </Field>

      <Field
        label="Descripción del disco"
        field="description"
        {...marks}
        hint="Se muestra en la ficha del álbum y sirve de texto por defecto en las colecciones."
      >
        <textarea value={form.description} onChange={set('description')} rows={8} className={`w-full ${INPUT}`} />
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
 * Alta manual de canciones. Necesaria para los discos cargados a mano: sin id
 * de Spotify no hay ingesta que les llene el tracklist.
 */
function NewTrackForm({ albumId, nextNumber }) {
  const create = useCreateTrack()
  const [title, setTitle] = useState('')
  const [number, setNumber] = useState(String(nextNumber))
  const [duration, setDuration] = useState('')
  const [error, setError] = useState('')

  // "3:35" -> 215000 ms
  const parseDuration = (value) => {
    const match = value.trim().match(/^(\d+):([0-5]?\d)$/)
    if (!match) return null
    return (Number(match[1]) * 60 + Number(match[2])) * 1000
  }

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    if (duration.trim() && parseDuration(duration) === null) {
      setError('La duración va en formato minutos:segundos, por ejemplo 3:35')
      return
    }

    create.mutate(
      {
        album_id: albumId,
        title: title.trim(),
        track_number: number ? Number(number) : null,
        duration_ms: duration.trim() ? parseDuration(duration) : null,
        disc_number: 1,
      },
      {
        onSuccess: () => {
          setTitle('')
          setNumber(String(Number(number || 0) + 1))
          setDuration('')
          setError('')
        },
        onError: e => setError(describeError(e)),
      }
    )
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 p-2 border-t border-rock-border">
      <input
        value={number}
        onChange={e => setNumber(e.target.value)}
        type="number"
        className={`w-14 text-center ${INPUT}`}
      />
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Título de la canción"
        className={`flex-1 ${INPUT}`}
      />
      <input
        value={duration}
        onChange={e => setDuration(e.target.value)}
        placeholder="3:35"
        className={`w-20 text-center ${INPUT}`}
      />
      <button
        type="submit"
        disabled={create.isPending || !title.trim()}
        className="bg-rock-accent text-white px-3 py-1 rounded text-xs font-semibold hover:opacity-90 disabled:opacity-50"
      >
        Agregar
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </form>
  )
}

function TrackRow({ track }) {
  const update = useCatalogUpdate('tracks')
  const remove = useDeleteTrack()
  const { isAdmin } = useRole()
  const [title, setTitle] = useState(track.title || '')
  const [number, setNumber] = useState(track.track_number ?? '')
  const [error, setError] = useState('')

  const patch = {}
  if (title.trim() !== (track.title || '')) patch.title = title.trim()
  const parsedNumber = number === '' ? null : Number(number)
  if (parsedNumber !== (track.track_number ?? null)) patch.track_number = parsedNumber

  const dirty = Object.keys(patch).length > 0

  const save = () => {
    update.mutate(
      { id: track.id, manual_fields: track.manual_fields, ...patch },
      { onError: e => setError(describeError(e)) }
    )
  }

  return (
    <div className="flex items-center gap-2 p-2">
      <input
        value={number}
        onChange={e => setNumber(e.target.value)}
        type="number"
        className={`w-14 text-center ${INPUT}`}
      />
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        className={`flex-1 ${INPUT}`}
      />
      <ManualFieldMark field="title" manualFields={track.manual_fields} />
      {error && <span className="text-red-400 text-xs">{error}</span>}
      <button
        onClick={save}
        disabled={!dirty || update.isPending}
        className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-30"
      >
        Guardar
      </button>
      {isAdmin && (
        <button
          onClick={() => {
            if (window.confirm(`¿Borrar "${track.title}"?`)) {
              remove.mutate(track.id, { onError: e => setError(describeError(e)) })
            }
          }}
          disabled={remove.isPending}
          className="text-xs text-gray-500 hover:text-red-400 disabled:opacity-50"
        >
          ✕
        </button>
      )}
    </div>
  )
}

export default function AdminAlbumEdit() {
  const { id } = useParams()
  const { data, isLoading } = useAdminAlbum(id)

  return (
    <RequireEditor>
      {isLoading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : !data ? (
        <p className="text-red-400">Álbum no encontrado.</p>
      ) : (
        <div className="space-y-6 max-w-3xl">
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              to={`/admin/artista/${data.album.artist?.id}`}
              className="text-gray-400 hover:text-rock-accent text-sm"
            >
              ← {data.album.artist?.name}
            </Link>
            <Link
              to={`/album/${data.album.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-rock-accent text-sm ml-auto"
            >
              Ver la página →
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-rock-text">{data.album.title}</h1>

          <AlbumForm key={data.album.id} album={data.album} />

          <div>
            <h2 className="text-lg font-bold text-rock-text mb-1">
              Canciones ({data.tracks.length})
            </h2>
            <p className="text-gray-500 text-sm mb-3">
              Número, título y duración. Cada fila se guarda por separado.
            </p>
            <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
              {data.tracks.map(t => <TrackRow key={t.id} track={t} />)}
              <NewTrackForm
                albumId={data.album.id}
                nextNumber={data.tracks.length + 1}
              />
            </div>

            {data.tracks.length === 0 && (
              <p className="text-gray-600 text-xs mt-2">
                {data.album.external_spotify_id
                  ? 'Los discos de Spotify cargan su tracklist solos al entrar a la página del álbum.'
                  : 'Este disco no viene de Spotify: las canciones se cargan a mano.'}
              </p>
            )}
          </div>
        </div>
      )}
    </RequireEditor>
  )
}
