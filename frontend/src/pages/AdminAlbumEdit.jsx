import { useState } from 'react'
import { useParams } from 'react-router-dom'
import AlbumLineup from '../components/common/AlbumLineup'
import { useConfirm } from '../components/common/ConfirmDialog'
import ImageField from '../components/common/ImageField'
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
import { formatReleaseDate, trackDuration } from '../services/dates'
import { SkeletonPanel } from '../components/common/States'
import ArrowLink from '../components/common/ArrowLink'
import RowMenu from '../components/common/RowMenu'
import AsideImage from '../components/common/AsideImage'
import { discGroups, sortTracks } from '../services/tracks'

const INPUT = 'input'

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
      {hint && <span className="block text-[11px] text-gray-500">{hint}</span>}
    </label>
  )
}

function AlbumForm({ album, onCoverPreview }) {
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

  // Para los campos que avisan el valor y no el evento, como ImageField.
  const setValue = (key) => (value) => {
    setSaved(false)
    setForm(f => ({ ...f, [key]: value }))
    // La portada se ve grande en la columna de la derecha, que está fuera de
    // este formulario: se le avisa el valor en vivo.
    if (key === 'cover_url') onCoverPreview?.(value)
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
    <div className="card space-y-3">
      <h2 className="font-display text-xl">Datos</h2>
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

      <Field label="Portada" field="cover_url" {...marks}>
        <ImageField
          value={form.cover_url}
          onChange={setValue('cover_url')}
          folder="albums"
          placeholder="URL de portada"
          previewClassName="lg:hidden"
        />
      </Field>

      <Field
        label="Descripción del disco"
        field="description"
        {...marks}
        hint="Se muestra en la ficha del álbum y sirve de texto por defecto en las colecciones."
      >
        <textarea value={form.description} onChange={set('description')} rows={8} className={`w-full ${INPUT}`} />
      </Field>

      {error && <p className="text-rock-accentBright text-sm">{error}</p>}

      <div className="flex items-center gap-3 justify-end pt-1">
        {saved && <span className="text-xs text-gray-500">Guardado</span>}
        <button
          onClick={save}
          disabled={!dirty || update.isPending}
          className="btn btn-primary px-7"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

/**
 * Alta manual de canciones. Necesaria para los discos cargados a mano: sin id
 * de Spotify no hay ingesta que les llene el tracklist.
 */
/*
 * En un doble se elige el disco, y el número propuesto es el siguiente de ese
 * disco: cada uno numera desde 1.
 */
function NewTrackForm({ albumId, discs }) {
  const create = useCreateTrack()
  const [title, setTitle] = useState('')
  const lastDisc = discs.length ? discs[discs.length - 1].disc : 1
  const nextIn = (d) => (discs.find(x => x.disc === d)?.items.length || 0) + 1
  const [disc, setDisc] = useState(lastDisc)
  const [number, setNumber] = useState(String(nextIn(lastDisc)))

  const pickDisc = (value) => {
    const d = Number(value)
    setDisc(d)
    setNumber(String(nextIn(d)))
  }
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
        disc_number: disc,
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
    <form onSubmit={submit} className="flex items-center gap-2 flex-wrap px-4 py-3 border-t border-rock-border bg-rock-dark/30">
      <span className="kicker w-full">Agregar canción</span>
      {discs.length > 1 && (
        <select
          value={disc}
          onChange={e => pickDisc(e.target.value)}
          aria-label="Disco"
          className={`!w-auto ${INPUT}`}
        >
          {discs.map(d => <option key={d.disc} value={d.disc}>Disco {d.disc}</option>)}
        </select>
      )}
      <input
        value={number}
        onChange={e => setNumber(e.target.value)}
        type="number"
        aria-label="Número"
        className={`!w-16 text-center ${INPUT}`}
      />
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Título de la canción"
        className={`flex-1 min-w-[160px] ${INPUT}`}
      />
      <input
        value={duration}
        onChange={e => setDuration(e.target.value)}
        placeholder="3:35"
        aria-label="Duración"
        className={`!w-20 text-center ${INPUT}`}
      />
      <button
        type="submit"
        disabled={create.isPending || !title.trim()}
        className="btn btn-primary !min-h-0 !px-4 !py-2 !text-[12.5px]"
      >
        Agregar
      </button>
      {error && <p className="field-error w-full !mt-0">{error}</p>}
    </form>
  )
}

function TrackRow({ track }) {
  const update = useCatalogUpdate('tracks')
  const remove = useDeleteTrack()
  const { isAdmin } = useRole()
  const confirm = useConfirm()
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

  const askDelete = async () => {
    const ok = await confirm({
      title: 'Borrar canción',
      message: `¿Borrar "${track.title}" del disco?`,
    })
    if (ok) remove.mutate(track.id, { onError: e => setError(describeError(e)) })
  }

  return (
    <div className="px-4 py-2.5 border-t border-rock-border first:border-t-0">
      <div className="flex items-center gap-2.5">
        <input
          value={number}
          onChange={e => setNumber(e.target.value)}
          type="number"
          aria-label="Número"
          className={`!w-16 text-center ${INPUT}`}
        />
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          aria-label="Título"
          className={`flex-1 min-w-0 ${INPUT}`}
        />
        <ManualFieldMark field="title" manualFields={track.manual_fields} />
        <span className="text-gray-500 text-[12.5px] tabular-nums w-11 text-right flex-none hidden sm:block">
          {trackDuration(track) || '—'}
        </span>
        {/* Guardar aparece sólo si la fila cambió: con veinte canciones,
            veinte botones apagados eran puro ruido. */}
        {dirty && (
          <button
            onClick={save}
            disabled={update.isPending}
            className="btn btn-primary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px] flex-none"
          >
            Guardar
          </button>
        )}
        {isAdmin && (
          <RowMenu
            disabled={remove.isPending}
            items={[{ label: 'Borrar canción', hint: 'No se puede deshacer.', onClick: askDelete, danger: true }]}
          />
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

export default function AdminAlbumEdit() {
  const { id } = useParams()
  const { data, isLoading } = useAdminAlbum(id)

  return (
    <RequireEditor>
      {isLoading ? (
        <SkeletonPanel />
      ) : !data ? (
        <p className="text-rock-accentBright">Álbum no encontrado.</p>
      ) : (
        <AlbumEditBody data={data} />
      )}
    </RequireEditor>
  )
}

function AlbumEditBody({ data }) {
  const { album } = data
  const [cover, setCover] = useState(album.cover_url || '')
  // Por disco y después por pista: un doble numera 1..n en cada disco.
  const tracks = sortTracks(data.tracks)
  const discs = discGroups(tracks)
  const year = album.release_date ? Number(album.release_date.slice(0, 4)) : null

  return (
    <div className="space-y-6">
      <ArrowLink back to={`/admin/artista/${album.artist?.id}`}>{album.artist?.name}</ArrowLink>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display text-3xl sm:text-4xl">{album.title}</h1>
        {album.hidden && <span className="tag tag-neutral">Oculto</span>}
        <ArrowLink to={`/album/${album.id}`} target="_blank" rel="noopener noreferrer" className="ml-auto">
          Ver la página
        </ArrowLink>
      </div>

      {/*
        En escritorio, dos columnas: a la izquierda lo que se edita (datos y
        canciones), a la derecha lo que se consulta (la portada y la formación
        de ese año). En el teléfono, una sola, con la formación al final.
      */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="space-y-6 min-w-0">
          <AlbumForm key={album.id} album={album} onCoverPreview={setCover} />

          <section>
            <h2 className="font-display text-2xl mb-1">Canciones ({tracks.length})</h2>
            <p className="text-gray-500 text-[13px] mb-3">
              Número y título. Cada fila se guarda por separado.
            </p>
            {/* Sin overflow-hidden: el menú "⋯" de la última fila sale por abajo. */}
            <div className="card !p-0">
              {discs.map(d => (
                <div key={d.disc}>
                  {discs.length > 1 && (
                    <p className="kicker px-4 pt-3 pb-1">Disco {d.disc}</p>
                  )}
                  {d.items.map(({ track }) => <TrackRow key={track.id} track={track} />)}
                </div>
              ))}
              <NewTrackForm key={discs.length} albumId={album.id} discs={discs} />
            </div>

            {tracks.length === 0 && (
              <p className="text-gray-500 text-xs mt-2">
                {album.external_spotify_id
                  ? 'Los discos de Spotify cargan su tracklist solos al entrar a la página del álbum.'
                  : 'Este disco no viene de Spotify: las canciones se cargan a mano.'}
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <AsideImage src={cover} saved={album.cover_url} alt={album.title} />

          {/*
            Formación del año del disco. Está acá para poder chequear que las
            fechas de las etapas den la alineación correcta: si falta o sobra
            alguien, el error está en el artista, no en el álbum.
          */}
          {year && (
            <div className="card space-y-2">
              <h2 className="font-display text-xl">Formación en {year}</h2>
              <AlbumLineup
                artistId={album.artist?.id}
                year={year}
                editHref={`/admin/artista/${album.artist?.id}`}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
