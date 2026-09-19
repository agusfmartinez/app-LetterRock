import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import ImageField from '../components/common/ImageField'
import ManualFieldMark from '../components/common/ManualFieldMark'
import MembersPanel from '../components/common/MembersPanel'
import RequireEditor from '../components/common/RequireEditor'
import {
  describeError,
  useAdminArtist,
  useCatalogUpdate,
  useCreateAlbum,
  useInvalidateCatalog,
  useReleaseManualField,
  useToggleHidden,
} from '../hooks/useCatalogAdmin'
import { slugify } from '../hooks/useCollectionAdmin'
import { linkArtistDiscography, refreshArtistFromSpotify } from '../services/api'
import { formatReleaseDate, timeAgo } from '../services/dates'
import { SkeletonPanel } from '../components/common/States'
import ArrowLink from '../components/common/ArrowLink'
import RowMenu from '../components/common/RowMenu'
import AsideImage from '../components/common/AsideImage'

const INPUT = 'input'

/**
 * Cuándo corrió esta ingesta por última vez.
 *
 * `updated_at` no servía: se mueve por cualquier escritura sobre el artista, así
 * que no distingue "nunca vinculé YouTube" de "le edité la bio ayer".
 */
function LastRun({ at }) {
  if (!at) {
    return <span className="text-gray-500 text-xs">nunca</span>
  }
  return (
    <span className="text-gray-500 text-xs" title={new Date(at).toLocaleString('es-AR')}>
      {timeAgo(at)}
    </span>
  )
}

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

function ArtistForm({ artist, onImagePreview }) {
  const update = useCatalogUpdate('artists')
  const release = useReleaseManualField('artists')
  const [form, setForm] = useState({
    name: artist.name || '',
    country: artist.country || '',
    formed_year: artist.formed_year ?? '',
    artist_type: artist.artist_type || '',
    image_url: artist.image_url || '',
    bio: artist.bio || '',
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
    // La foto se ve grande en la columna de la derecha, fuera de este
    // formulario: se le avisa el valor en vivo.
    if (key === 'image_url') onImagePreview?.(value)
  }

  const changed = () => {
    const patch = {}
    if (form.name.trim() !== (artist.name || '')) patch.name = form.name.trim()
    if (form.country.trim() !== (artist.country || '')) patch.country = form.country.trim() || null
    const year = form.formed_year ? Number(form.formed_year) : null
    if (year !== (artist.formed_year ?? null)) patch.formed_year = year
    if (form.artist_type !== (artist.artist_type || '')) patch.artist_type = form.artist_type || null
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
    <div className="card space-y-3">
      <h2 className="font-display text-xl">Datos</h2>
      <Field label="Nombre" field="name" {...marks}>
        <input value={form.name} onChange={set('name')} className={`w-full ${INPUT}`} />
      </Field>

      <div className="flex gap-3 flex-wrap">
        <Field label="País" field="country" {...marks}>
          <input value={form.country} onChange={set('country')} placeholder="AR" className={`w-20 ${INPUT}`} />
        </Field>
        {/* Sigue el selector de al lado: es la misma columna, y llamarla
            "formación" cuando el tipo dice músico confunde al que edita. */}
        <Field
          label={form.artist_type === 'person' ? 'Año de nacimiento' : 'Año de formación'}
          field="formed_year"
          {...marks}
        >
          <input value={form.formed_year} onChange={set('formed_year')} type="number" className={`w-28 ${INPUT}`} />
        </Field>
        <Field label="Tipo" field="artist_type" {...marks}>
          <select value={form.artist_type} onChange={set('artist_type')} className={INPUT}>
            <option value="">Sin definir</option>
            <option value="group">Banda</option>
            <option value="person">Músico</option>
            <option value="other">Otro</option>
          </select>
        </Field>
      </div>

      <Field label="Imagen" field="image_url" {...marks}>
        <ImageField
          value={form.image_url}
          onChange={setValue('image_url')}
          folder="artists"
          placeholder="URL de imagen"
          previewClassName="lg:hidden"
        />
      </Field>

      <Field label="Biografía" field="bio" {...marks}>
        <textarea value={form.bio} onChange={set('bio')} rows={8} className={`w-full ${INPUT}`} />
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
    <div className="card space-y-2">
      <h2 className="font-display text-xl">Visibilidad</h2>
      <p className="text-gray-500 text-xs">
        {artist.hidden
          ? 'Oculto: no aparece en búsquedas, ni en la home, ni entre los resultados de MusicBrainz.'
          : 'Visible en toda la app. Ocultalo si no corresponde al catálogo de rock nacional.'}
      </p>
      {error && <p className="text-rock-accentBright text-xs">{error}</p>}
      <button
        onClick={() => toggle.mutate(
          { id: artist.id, hidden: !artist.hidden },
          { onError: e => setError(describeError(e)) }
        )}
        disabled={toggle.isPending}
        className={`btn !min-h-0 !px-3.5 !py-1.5 !text-[12.5px] ${
          artist.hidden ? 'btn-primary' : 'btn-secondary hover:!text-rock-accentBright'
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
      <button onClick={() => setOpen(true)} className="btn btn-secondary !min-h-0 !px-4 !py-2 !text-[13px]">
        + Agregar disco a mano
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h3 className="font-display text-xl">Disco nuevo</h3>
      <p className="text-gray-500 text-xs">
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
      <ImageField
        value={form.cover_url}
        onChange={url => setForm(f => ({ ...f, cover_url: url }))}
        folder="albums"
        placeholder="URL de portada (opcional)"
      />
      {error && <p className="text-rock-accentBright text-sm">{error}</p>}
      <div className="flex items-center gap-3 justify-end">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={create.isPending || !form.title.trim()}
          className="btn btn-primary"
        >
          Crear disco
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
function SpotifyRefresh({ artist }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const invalidate = useInvalidateCatalog()

  const run = async () => {
    setBusy(true)
    setError('')
    setStatus(null)
    try {
      setStatus(await refreshArtistFromSpotify(artist.id))
      invalidate()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo conectar con Spotify')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-xl">Spotify</h2>
        <LastRun at={artist.spotify_refreshed_at} />
      </div>
      <p className="text-gray-500 text-xs">
        Vuelve a traer título, fecha, precisión de fecha, tipo y portada de todos los
        discos. Los campos que editaste a mano no se tocan.
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px]"
      >
        Refrescar metadatos
      </button>

      {busy && <p className="text-gray-500 text-xs">Consultando Spotify...</p>}
      {error && <p className="text-rock-accentBright text-xs">{error}</p>}
      {status && (
        <div className="text-xs space-y-1">
          <p className="text-gray-400">{status.saved} de {status.total} discos actualizados</p>
          {status.errors?.map(e => <p key={e} className="text-gray-500">{e}</p>)}
        </div>
      )}
    </div>
  )
}

function YoutubeDiscography({ artist }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()
  const invalidate = useInvalidateCatalog()

  const run = async () => {
    setBusy(true)
    setError('')
    setStatus(null)
    try {
      setStatus(await linkArtistDiscography(artist.id))
      // Vincular reescribe `media_links`, que es de donde sale el tema
      // destacado y el ranking de reproducciones de la timeline.
      queryClient.invalidateQueries({ queryKey: ['album-media'] })
      // Y deja la marca de última corrida en el artista, que es lo que lee
      // esta misma card y el aviso de "sin YouTube" del catálogo.
      invalidate()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo conectar con YouTube')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-xl">YouTube Music</h2>
        <LastRun at={artist.youtube_linked_at} />
      </div>
      <p className="text-gray-500 text-xs">
        Busca el canal del artista y vincula todos sus discos de una. Los tracklists que
        falten se traen de Spotify en el momento.
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px]"
      >
        Vincular discografía
      </button>

      {busy && <p className="text-gray-500 text-xs">Consultando YouTube...</p>}
      {error && <p className="text-rock-accentBright text-xs">{error}</p>}

      {status && (
        <div className="text-xs space-y-1">
          {status.skipped ? (
            <p className="text-gray-400">No se pudo: {status.skipped}</p>
          ) : (
            <>
              <p className="text-gray-400">
                {status.albums?.filter(a => a.matched).length} de {status.albums?.length} álbumes vinculados
              </p>
              {/* Los rescatados por tema: el canal no publica el disco, pero
                  sí sus canciones dentro de otro. Vale avisar, porque el video
                  puede ser de una edición distinta. */}
              {status.albums?.filter(a => a.loose).map(a => (
                <p key={a.album} className="text-gray-500">
                  {a.album}: {a.matched} de {a.total} vinculados por nombre de tema
                </p>
              ))}
              {status.albums?.filter(a => a.skipped).map(a => (
                <p key={a.album} className="text-gray-500">{a.album}: {a.skipped}</p>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

const ALBUM_TYPE = { album: 'Álbum', single: 'Sencillo', ep: 'EP', compilation: 'Recopilado' }
const TAG = 'tag !text-[10.5px] !py-0.5'

function AlbumRow({ album }) {
  const toggle = useToggleHidden('albums')
  const edited = album.manual_fields?.length || 0

  return (
    <div className="flex items-center gap-3.5 px-4 py-3 border-t border-rock-border first:border-t-0">
      <div className={`w-11 h-11 rounded-[8px] overflow-hidden bg-rock-border flex-none ${album.hidden ? 'opacity-40' : ''}`}>
        {album.cover_url && <img src={album.cover_url} alt="" className="w-full h-full object-cover washed" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/admin/album/${album.id}`}
            className={`text-[14.5px] font-medium hover:text-rock-accent ${album.hidden ? 'text-gray-500' : ''}`}
          >
            {album.title}
          </Link>
          {edited > 0 && <span className={`${TAG} tag-accent`}>Editado</span>}
          {album.hidden && <span className={`${TAG} tag-neutral`}>Oculto</span>}
        </div>
        <p className="text-gray-500 text-[12.5px] mt-0.5">
          {[ALBUM_TYPE[album.album_type] || album.album_type, formatReleaseDate(album) || 'Sin fecha'].join(' · ')}
        </p>
      </div>
      <Link
        to={`/admin/album/${album.id}`}
        className="btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px] hidden sm:inline-flex"
      >
        Editar
      </Link>
      <ArrowLink to={`/album/${album.id}`} target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex">Ver</ArrowLink>
      <RowMenu
        disabled={toggle.isPending}
        items={[{
          label: album.hidden ? 'Mostrar' : 'Ocultar',
          hint: album.hidden ? 'Vuelve a la discografía.' : 'Lo saca de la discografía, sin borrarlo.',
          onClick: () => toggle.mutate({ id: album.id, hidden: !album.hidden }),
          danger: !album.hidden,
        }]}
      />
    </div>
  )
}

export default function AdminArtistEdit() {
  const { id } = useParams()
  const { data, isLoading } = useAdminArtist(id)
  // La foto que se está editando, en vivo, para la columna de la derecha.
  // `null` = la guardada.
  const [image, setImage] = useState(null)
  useEffect(() => { setImage(null) }, [id])

  return (
    <RequireEditor>
      {isLoading ? (
        <SkeletonPanel />
      ) : !data ? (
        <p className="text-rock-accentBright">Artista no encontrado.</p>
      ) : (
        <div className="space-y-6">
          <ArrowLink back to="/admin/catalogo">Catálogo</ArrowLink>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-3xl sm:text-4xl">{data.artist.name}</h1>
            {data.artist.hidden && <span className="tag tag-neutral">Oculto</span>}
            <ArrowLink to={`/artist/${data.artist.slug}`} target="_blank" rel="noopener noreferrer" className="ml-auto">
              Ver la página
            </ArrowLink>
          </div>

          {/*
            En escritorio, dos columnas: a la izquierda lo que se edita (datos,
            integrantes, discos) y a la derecha lo que se corre (visibilidad y
            las ingestas de Spotify y YouTube). En el teléfono, una sola columna
            con las ingestas al final.
          */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
            <div className="space-y-6 min-w-0">
              <ArtistForm key={data.artist.id} artist={data.artist} onImagePreview={setImage} />

              <MembersPanel artist={data.artist} />

              <section>
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <h2 className="font-display text-2xl">Discos ({data.albums.length})</h2>
                </div>
                {data.albums.length === 0 ? (
                  <p className="text-gray-500 text-sm mb-4">Sin discos cargados.</p>
                ) : (
                  // Sin overflow-hidden: el menú "⋯" de la última fila sale por abajo.
                  <div className="card !p-0 mb-4">
                    {data.albums.map(a => <AlbumRow key={a.id} album={a} />)}
                  </div>
                )}

                <NewAlbumForm artistId={data.artist.id} />
              </section>
            </div>

            <aside className="space-y-6 lg:sticky lg:top-24">
              <AsideImage src={image ?? data.artist.image_url} saved={data.artist.image_url} alt={data.artist.name} />
              <HiddenToggle artist={data.artist} />
              <SpotifyRefresh artist={data.artist} />
              <YoutubeDiscography artist={data.artist} />
            </aside>
          </div>
        </div>
      )}
    </RequireEditor>
  )
}
