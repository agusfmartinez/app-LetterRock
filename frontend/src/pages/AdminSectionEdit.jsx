import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import RequireEditor from '../components/common/RequireEditor'
import {
  describeError,
  EMPTY_ALBUM_FILTERS,
  useAlbumSearch,
  useCollectionAdmin,
} from '../hooks/useCollectionAdmin'
import { groupEntriesByYear, useCollectionSection } from '../hooks/useCollections'
import { formatReleaseDate } from '../services/dates'
import { linkAlbumToYoutube, linkArtistDiscography, refreshYoutubeViews } from '../services/api'

const INPUT = 'bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent'

function SectionFields({ section }) {
  const { updateSection } = useCollectionAdmin()
  const [form, setForm] = useState({
    title: section.title,
    subtitle: section.subtitle || '',
    intro_text: section.intro_text || '',
    cover_url: section.cover_url || '',
    year_from: section.year_from ?? '',
    year_to: section.year_to ?? '',
  })
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const save = () => {
    updateSection.mutate(
      {
        id: section.id,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        intro_text: form.intro_text.trim() || null,
        cover_url: form.cover_url.trim() || null,
        year_from: form.year_from ? Number(form.year_from) : null,
        year_to: form.year_to ? Number(form.year_to) : null,
      },
      { onError: e => setError(describeError(e)) }
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-gray-500 hover:text-rock-accent">
        Editar datos de la época ▾
      </button>
    )
  }

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <div className="flex gap-2 flex-wrap">
        <input value={form.title} onChange={set('title')} className={`flex-1 min-w-[160px] ${INPUT}`} />
        <input value={form.year_from} onChange={set('year_from')} placeholder="Desde" type="number" className={`w-24 ${INPUT}`} />
        <input value={form.year_to} onChange={set('year_to')} placeholder="Hasta" type="number" className={`w-24 ${INPUT}`} />
      </div>
      <input value={form.subtitle} onChange={set('subtitle')} placeholder="Bajada" className={`w-full ${INPUT}`} />
      <textarea
        value={form.intro_text}
        onChange={set('intro_text')}
        placeholder="Texto de apertura de la época. Una línea en blanco separa párrafos."
        rows={4}
        className={`w-full ${INPUT}`}
      />
      <input value={form.cover_url} onChange={set('cover_url')} placeholder="URL de portada de la sección (opcional)" className={`w-full ${INPUT}`} />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={updateSection.isPending}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Guardar sección
        </button>
        <button onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-rock-text">
          Cerrar
        </button>
      </div>
    </div>
  )
}

/** Fila de una línea. No despliega nada: al elegirla se edita en el panel derecho. */
function EntryRow({ entry, selected, onSelect }) {
  const album = entry.album
  const artist = entry.artist || album?.artist
  const label = album?.title || entry.artist?.name || entry.title || 'Bloque de texto'
  const dateLabel = album ? formatReleaseDate(album) : entry.year ? String(entry.year) : null

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left flex items-center gap-3 px-3 py-2 transition-colors ${
        selected ? 'bg-rock-accent/10 border-l-2 border-rock-accent' : 'hover:bg-rock-dark'
      }`}
    >
      <div className="w-9 h-9 rounded overflow-hidden bg-rock-dark flex-shrink-0">
        {album?.cover_url ? (
          <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
        ) : entry.artist?.image_url ? (
          <img src={entry.artist.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm">📝</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${selected ? 'text-rock-accent font-semibold' : 'text-rock-text'}`}>
          {label}
        </p>
        <p className="text-gray-500 text-xs truncate">
          {artist?.name}
          {artist?.name && dateLabel ? ' · ' : ''}
          {dateLabel}
        </p>
      </div>

      {!entry.body_text && <span className="text-xs text-gray-600 flex-shrink-0">sin texto</span>}
    </button>
  )
}

function EntriesByYear({ entries, selectedId, onSelect }) {
  const groups = useMemo(() => groupEntriesByYear(entries), [entries])

  return (
    <div className="space-y-4">
      {groups.map(group => (
        <div key={group.label}>
          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="text-lg font-black text-rock-accent">{group.label}</h3>
            <span className="text-gray-600 text-xs">
              {group.entries.length} {group.entries.length === 1 ? 'entrada' : 'entradas'}
            </span>
          </div>
          <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border overflow-hidden">
            {group.entries.map(e => (
              <EntryRow
                key={e.id}
                entry={e}
                selected={selectedId === e.id}
                onSelect={() => onSelect(e.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Único formulario de edición de la página. Se remonta con `key={entry.id}`
 * al cambiar de entrada, así el estado local arranca limpio.
 */
function EntryEditor({ entry, onClose }) {
  const { updateEntry, deleteEntry } = useCollectionAdmin()
  const [form, setForm] = useState({
    body_text: entry.body_text || '',
    title: entry.title || '',
    year: entry.year ?? '',
    image_url: entry.image_url || '',
  })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const album = entry.album
  const isNarrative = entry.entry_type === 'narrative'
  const label = album?.title || entry.artist?.name || entry.title || 'Bloque de texto'

  const set = (key) => (e) => {
    setSaved(false)
    setForm({ ...form, [key]: e.target.value })
  }

  const save = () => {
    const patch = { id: entry.id, body_text: form.body_text.trim() || null }
    if (isNarrative) {
      patch.title = form.title.trim() || null
      patch.year = form.year ? Number(form.year) : null
      patch.image_url = form.image_url.trim() || null
    }
    updateEntry.mutate(patch, {
      onSuccess: () => { setError(''); setSaved(true) },
      onError: e => setError(describeError(e)),
    })
  }

  const remove = () => {
    if (!window.confirm(`¿Quitar "${label}" de esta sección?`)) return
    deleteEntry.mutate(entry.id, {
      onSuccess: onClose,
      onError: e => setError(describeError(e)),
    })
  }

  return (
    <div className="bg-rock-card border border-rock-accent rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        {album?.cover_url && (
          <img src={album.cover_url} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-rock-text font-semibold truncate">{label}</p>
          <p className="text-gray-500 text-xs truncate">
            {(entry.artist || album?.artist)?.name}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-rock-text text-sm flex-shrink-0">
          ✕
        </button>
      </div>

      {isNarrative && (
        <div className="flex gap-2 flex-wrap">
          <input value={form.title} onChange={set('title')} placeholder="Título del bloque" className={`flex-1 min-w-[140px] ${INPUT}`} />
          <input value={form.year} onChange={set('year')} placeholder="Año" type="number" className={`w-24 ${INPUT}`} />
        </div>
      )}

      <textarea
        value={form.body_text}
        onChange={set('body_text')}
        placeholder="Texto editorial. Una línea en blanco separa párrafos."
        rows={10}
        className={`w-full ${INPUT}`}
      />

      {/*
        No se precarga la descripción sola: mientras el campo esté vacío la
        timeline la muestra igual, y así sigue en sincronía si después se edita
        el disco. Copiarla es un acto explícito, para partir de ese texto.
      */}
      {!form.body_text.trim() && album?.description && (
        <div className="text-gray-600 text-xs space-y-1">
          <p>
            Vacío: la timeline muestra la descripción del disco. Escribí acá para
            contar qué significa en esta colección.
          </p>
          <button
            onClick={() => { setSaved(false); setForm({ ...form, body_text: album.description }) }}
            className="text-rock-accent hover:underline"
          >
            Copiar la descripción para editarla acá
          </button>
        </div>
      )}

      {isNarrative && (
        <>
          <input value={form.image_url} onChange={set('image_url')} placeholder="URL de imagen (opcional)" className={`w-full ${INPUT}`} />
          {form.image_url && (
            <img src={form.image_url} alt="" className="max-h-32 rounded border border-rock-border" />
          )}
        </>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={updateEntry.isPending}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Guardar
        </button>
        {saved && <span className="text-xs text-gray-500">Guardado</span>}
        <button onClick={remove} className="ml-auto text-xs text-gray-500 hover:text-red-400">
          Quitar de la sección
        </button>
      </div>

      {album && <YoutubePanel albumId={album.id} artist={album.artist} />}
    </div>
  )
}

/**
 * Vinculación con YouTube Music. Se dispara a mano porque la búsqueda cuesta
 * 100 de las 10.000 unidades diarias de cuota; el refresco de reproducciones
 * cuesta 1 cada 50 temas y se puede repetir sin problema.
 */
function YoutubePanel({ albumId, artist }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action, label) => {
    setBusy(true)
    setError('')
    setStatus(null)
    try {
      setStatus({ ...(await action(albumId)), label })
    } catch (err) {
      const data = err.response?.data
      const albums = data?.availableAlbums
      setError(
        (data?.error || err.message || 'No se pudo conectar con YouTube') +
        (albums?.length ? ` — el canal sí tiene: ${albums.slice(0, 12).join(', ')}` : '')
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-rock-border pt-3 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => run(linkAlbumToYoutube, 'link')}
          disabled={busy}
          className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-50"
        >
          Vincular con YouTube
        </button>
        {artist?.id && (
          <button
            onClick={() => run(() => linkArtistDiscography(artist.id), 'discography')}
            disabled={busy}
            className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-50"
          >
            Vincular discografía completa
          </button>
        )}
        <button
          onClick={() => run(refreshYoutubeViews, 'refresh')}
          disabled={busy}
          className="text-xs text-gray-500 hover:text-rock-accent disabled:opacity-50"
        >
          Refrescar reproducciones
        </button>
      </div>

      {busy && <p className="text-gray-500 text-xs">Consultando YouTube...</p>}
      {error && <p className="text-red-400 text-xs">{error}</p>}

      {status?.label === 'link' && (
        <div className="text-xs space-y-1">
          <p className="text-gray-400">
            {status.matched} de {status.total} temas vinculados
            {!status.channelWasCached && ' (canal del artista resuelto y guardado)'}
          </p>
          {status.partial > 0 && (
            <p className="text-gray-600">{status.partial} por coincidencia parcial de título</p>
          )}
          {status.unmatched?.length > 0 && (
            <p className="text-gray-600">Sin match: {status.unmatched.join(', ')}</p>
          )}
          {status.top?.length > 0 && (
            <div className="pt-1">
              <p className="text-gray-500">Más escuchados:</p>
              {status.top.map(t => (
                <p key={t.title} className="text-gray-400">
                  {t.title} — {t.views?.toLocaleString('es-AR')}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {status?.label === 'discography' && (
        <div className="text-xs space-y-1">
          {status.skipped ? (
            <p className="text-gray-400">No se pudo: {status.skipped}</p>
          ) : (
            <>
              <p className="text-gray-400">
                {status.albums?.filter(a => a.matched).length} de {status.albums?.length} álbumes vinculados
                {status.albums?.some(a => a.ingested) &&
                  ` · ${status.albums.filter(a => a.ingested).length} con tracks recién traídos de Spotify`}
              </p>
              {status.albums?.filter(a => a.skipped).map(a => (
                <p key={a.album} className="text-gray-600">{a.album}: {a.skipped}</p>
              ))}
            </>
          )}
        </div>
      )}

      {status?.label === 'refresh' && (
        <p className="text-gray-400 text-xs">{status.updated} temas actualizados</p>
      )}
    </div>
  )
}

/** Buscador de discos. Arranca vacío: muestra resultados recién al ejecutar la consulta. */
function AlbumSearchPanel({ collection, section }) {
  const [form, setForm] = useState({
    ...EMPTY_ALBUM_FILTERS,
    yearFrom: section.year_from ?? '',
    yearTo: section.year_to ?? '',
  })
  const [filters, setFilters] = useState(null)
  const { data: albums = [], isLoading, error } = useAlbumSearch(section, filters, !!filters)
  const { createEntry } = useCollectionAdmin()
  const [addError, setAddError] = useState('')

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const search = (e) => {
    e.preventDefault()
    setFilters({ ...form })
  }

  const reset = () => {
    setForm({ ...EMPTY_ALBUM_FILTERS, yearFrom: section.year_from ?? '', yearTo: section.year_to ?? '' })
    setFilters(null)
  }

  const add = (album) => {
    createEntry.mutate(
      {
        collection_id: collection.id,
        section_id: section.id,
        entry_type: 'album',
        album_id: album.id,
      },
      {
        onSuccess: () => setAddError(''),
        onError: e => setAddError(describeError(e)),
      }
    )
  }

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <h2 className="font-bold text-rock-text">Buscar discos</h2>

      <form onSubmit={search} className="space-y-2">
        <input value={form.title} onChange={set('title')} placeholder="Título del disco" className={`w-full ${INPUT}`} />
        <input value={form.artist} onChange={set('artist')} placeholder="Banda" className={`w-full ${INPUT}`} />
        <div className="flex gap-2">
          <input value={form.yearFrom} onChange={set('yearFrom')} placeholder="Desde" type="number" className={`w-1/2 ${INPUT}`} />
          <input value={form.yearTo} onChange={set('yearTo')} placeholder="Hasta" type="number" className={`w-1/2 ${INPUT}`} />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={form.studioOnly}
            onChange={e => setForm({ ...form, studioOnly: e.target.checked })}
            className="accent-rock-accent"
          />
          Sólo álbumes de estudio
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90"
          >
            Buscar
          </button>
          {filters && (
            <button type="button" onClick={reset} className="text-xs text-gray-500 hover:text-rock-text">
              Limpiar
            </button>
          )}
        </div>
      </form>

      {addError && <p className="text-red-400 text-sm">{addError}</p>}
      {error && <p className="text-red-400 text-sm">{describeError(error)}</p>}

      {!filters ? (
        <p className="text-gray-600 text-xs border-t border-rock-border pt-3">
          Los años vienen del rango de la época. Ajustá los filtros y tocá Buscar.
        </p>
      ) : isLoading ? (
        <p className="text-gray-500 text-sm border-t border-rock-border pt-3">Buscando...</p>
      ) : albums.length === 0 ? (
        <p className="text-gray-500 text-sm border-t border-rock-border pt-3">
          Sin resultados. Si falta una banda, buscala primero en la app para que se ingeste.
        </p>
      ) : (
        <div className="border-t border-rock-border pt-3 space-y-1 max-h-[28rem] overflow-y-auto">
          <p className="text-gray-600 text-xs">{albums.length} resultados</p>
          {albums.map(a => (
            <div key={a.id} className="flex items-center gap-2 py-1">
              <div className="w-9 h-9 rounded overflow-hidden bg-rock-dark flex-shrink-0">
                {a.cover_url ? (
                  <img src={a.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm">💿</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-rock-text text-sm truncate">{a.title}</p>
                <p className="text-gray-500 text-xs truncate">
                  {a.artist?.name}
                  {a.release_date ? ` · ${formatReleaseDate(a)}` : ''}
                </p>
              </div>
              <button
                onClick={() => add(a)}
                disabled={createEntry.isPending}
                className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-50 flex-shrink-0"
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewNarrativeForm({ collection, section }) {
  const { createEntry } = useCollectionAdmin()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', year: '', body: '', image_url: '' })
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    if (!form.body.trim()) return
    createEntry.mutate(
      {
        collection_id: collection.id,
        section_id: section.id,
        entry_type: 'narrative',
        title: form.title.trim() || null,
        year: form.year ? Number(form.year) : null,
        image_url: form.image_url.trim() || null,
        body_text: form.body.trim(),
      },
      {
        onSuccess: () => {
          setForm({ title: '', year: '', body: '', image_url: '' })
          setError('')
          setOpen(false)
        },
        onError: (err) => setError(describeError(err)),
      }
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-gray-500 hover:text-rock-accent">
        + Agregar bloque de texto
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <h3 className="font-bold text-rock-text text-sm">Bloque de texto</h3>
      <p className="text-gray-600 text-xs">
        Para hitos sin disco asociado. El año lo ubica en la cronología.
      </p>
      <div className="flex gap-2">
        <input value={form.title} onChange={set('title')} placeholder="Título (opcional)" className={`flex-1 ${INPUT}`} />
        <input value={form.year} onChange={set('year')} placeholder="Año" type="number" className={`w-24 ${INPUT}`} />
      </div>
      <textarea value={form.body} onChange={set('body')} placeholder="Texto" rows={3} className={`w-full ${INPUT}`} />
      <input value={form.image_url} onChange={set('image_url')} placeholder="URL de imagen (opcional)" className={`w-full ${INPUT}`} />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={createEntry.isPending || !form.body.trim()}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Agregar bloque
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-rock-text">
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function AdminSectionEdit() {
  const { slug, sectionSlug } = useParams()
  const { data, isLoading } = useCollectionSection(slug, sectionSlug)
  const [selectedId, setSelectedId] = useState(null)

  const entries = data?.entries || []
  const selected = entries.find(e => e.id === selectedId) || null

  // Si la entrada abierta se borró, cerrar el panel.
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null)
  }, [selectedId, selected])

  return (
    <RequireEditor>
      {isLoading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : !data?.section ? (
        <p className="text-red-400">Sección no encontrada.</p>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              to={`/admin/coleccion/${data.collection.slug}`}
              className="text-gray-400 hover:text-rock-accent text-sm"
            >
              ← {data.collection.title}
            </Link>
            <Link
              to={`/coleccion/${data.collection.slug}/${data.section.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-rock-accent text-sm ml-auto"
            >
              Ver la página →
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-rock-text">{data.section.title}</h1>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Contenido cargado */}
            <div className="flex-1 min-w-0 space-y-6">
              <SectionFields section={data.section} />

              <div>
                <h2 className="text-lg font-bold text-rock-text mb-1">
                  Entradas ({entries.length})
                </h2>
                <p className="text-gray-500 text-sm mb-3">
                  Agrupadas por año. Elegí una para editarla en el panel de la derecha.
                </p>
                {entries.length === 0 ? (
                  <p className="text-gray-500 text-sm">Todavía no hay entradas.</p>
                ) : (
                  <EntriesByYear
                    entries={entries}
                    selectedId={selectedId}
                    onSelect={id => setSelectedId(id === selectedId ? null : id)}
                  />
                )}
              </div>

              <NewNarrativeForm collection={data.collection} section={data.section} />
            </div>

            {/* Panel lateral: edición + búsqueda */}
            <aside className="w-full lg:w-96 lg:flex-shrink-0 lg:sticky lg:top-24 space-y-4">
              {selected && (
                <EntryEditor
                  key={selected.id}
                  entry={selected}
                  onClose={() => setSelectedId(null)}
                />
              )}
              <AlbumSearchPanel collection={data.collection} section={data.section} />
            </aside>
          </div>
        </div>
      )}
    </RequireEditor>
  )
}
