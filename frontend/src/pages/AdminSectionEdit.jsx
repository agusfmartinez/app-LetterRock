import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import RequireEditor from '../components/common/RequireEditor'
import { useAlbumSuggestions, useCollectionAdmin } from '../hooks/useCollectionAdmin'
import { useCollectionSection } from '../hooks/useCollections'

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
      { onError: e => setError(e.message) }
    )
  }

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <div className="flex gap-2 flex-wrap">
        <input
          value={form.title}
          onChange={set('title')}
          className="flex-1 min-w-[160px] bg-rock-dark border border-rock-border rounded px-3 py-2 text-rock-text focus:outline-none focus:border-rock-accent"
        />
        <input
          value={form.year_from}
          onChange={set('year_from')}
          placeholder="Desde"
          type="number"
          className="w-24 bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500"
        />
        <input
          value={form.year_to}
          onChange={set('year_to')}
          placeholder="Hasta"
          type="number"
          className="w-24 bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500"
        />
      </div>
      <input
        value={form.subtitle}
        onChange={set('subtitle')}
        placeholder="Bajada"
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />
      <textarea
        value={form.intro_text}
        onChange={set('intro_text')}
        placeholder="Texto de apertura de la época. Una línea en blanco separa párrafos."
        rows={4}
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />
      <input
        value={form.cover_url}
        onChange={set('cover_url')}
        placeholder="URL de portada de la sección (opcional)"
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        onClick={save}
        disabled={updateSection.isPending}
        className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        Guardar sección
      </button>
    </div>
  )
}

function EntryRow({ entry }) {
  const { updateEntry, deleteEntry } = useCollectionAdmin()
  const [body, setBody] = useState(entry.body_text || '')
  const [error, setError] = useState('')

  const album = entry.album
  const artist = entry.artist || album?.artist
  const year = album?.release_date ? new Date(album.release_date).getFullYear() : entry.year
  const label = album?.title || entry.artist?.name || entry.title || 'Bloque de texto'
  const dirty = body !== (entry.body_text || '')

  const remove = () => {
    if (!window.confirm(`¿Quitar "${label}" de esta sección?`)) return
    deleteEntry.mutate(entry.id, { onError: e => setError(e.message) })
  }

  return (
    <div className="flex gap-3 p-3">
      <div className="w-14 h-14 rounded overflow-hidden bg-rock-dark flex-shrink-0">
        {album?.cover_url ? (
          <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
        ) : entry.artist?.image_url ? (
          <img src={entry.artist.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">📝</div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-rock-text font-medium">{label}</span>
          {artist && <span className="text-gray-500 text-sm">{artist.name}</span>}
          {year && <span className="text-rock-accent text-xs font-bold">{year}</span>}
        </div>

        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Texto editorial del disco."
          rows={3}
          className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={() => updateEntry.mutate(
              { id: entry.id, body_text: body.trim() || null },
              { onError: e => setError(e.message) }
            )}
            disabled={!dirty || updateEntry.isPending}
            className="bg-rock-accent text-white px-3 py-1 rounded text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            Guardar texto
          </button>
          <button onClick={remove} className="text-xs text-gray-500 hover:text-red-400">
            Quitar
          </button>
        </div>
      </div>
    </div>
  )
}

function NewNarrativeForm({ collection, section }) {
  const { createEntry } = useCollectionAdmin()
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!body.trim()) return
    createEntry.mutate(
      {
        collection_id: collection.id,
        section_id: section.id,
        entry_type: 'narrative',
        title: title.trim() || null,
        year: year ? Number(year) : null,
        body_text: body.trim(),
      },
      {
        onSuccess: () => { setTitle(''); setYear(''); setBody(''); setError('') },
        onError: (err) => setError(err.message),
      }
    )
  }

  return (
    <form onSubmit={submit} className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <h3 className="font-bold text-rock-text text-sm">Bloque de texto</h3>
      <p className="text-gray-600 text-xs">
        Para hitos sin disco asociado. El año lo ubica en la cronología.
      </p>
      <div className="flex gap-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Título (opcional)"
          className="flex-1 bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
        />
        <input
          value={year}
          onChange={e => setYear(e.target.value)}
          placeholder="Año"
          type="number"
          className="w-24 bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500"
        />
      </div>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Texto"
        rows={3}
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={createEntry.isPending || !body.trim()}
        className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        Agregar bloque
      </button>
    </form>
  )
}

function Suggestions({ collection, section }) {
  const [search, setSearch] = useState('')
  const { data: albums = [], isLoading } = useAlbumSuggestions(section, search)
  const { createEntry } = useCollectionAdmin()
  const [error, setError] = useState('')

  const add = (album) => {
    createEntry.mutate(
      {
        collection_id: collection.id,
        section_id: section.id,
        entry_type: 'album',
        album_id: album.id,
      },
      { onError: e => setError(e.message) }
    )
  }

  const rangeLabel = section.year_from && section.year_to
    ? `${section.year_from}–${section.year_to}`
    : 'sin rango de años'

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-rock-text">Agregar discos</h2>
        <p className="text-gray-500 text-sm mt-1">
          Álbumes de la DB que caen en {rangeLabel} y todavía no están en la sección.
          Buscá por título para salir del rango.
        </p>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por título de álbum..."
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : albums.length === 0 ? (
        <p className="text-gray-500 text-sm">
          Sin candidatos. Si falta una banda, buscala primero en la app para que se ingeste.
        </p>
      ) : (
        <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border max-h-96 overflow-y-auto">
          {albums.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-2">
              <div className="w-10 h-10 rounded overflow-hidden bg-rock-dark flex-shrink-0">
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
                  {a.release_date ? ` · ${new Date(a.release_date).getFullYear()}` : ''}
                </p>
              </div>
              <button
                onClick={() => add(a)}
                disabled={createEntry.isPending}
                className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-50"
              >
                + Agregar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminSectionEdit() {
  const { slug, sectionSlug } = useParams()
  const { data, isLoading } = useCollectionSection(slug, sectionSlug)

  return (
    <RequireEditor>
      {isLoading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : !data?.section ? (
        <p className="text-red-400">Sección no encontrada.</p>
      ) : (
        <div className="space-y-6 max-w-3xl">
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              to={`/admin/coleccion/${data.collection.slug}`}
              className="text-gray-400 hover:text-rock-accent text-sm"
            >
              ← {data.collection.title}
            </Link>
            <Link
              to={`/coleccion/${data.collection.slug}/${data.section.slug}`}
              className="text-gray-500 hover:text-rock-accent text-sm ml-auto"
            >
              Ver la página →
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-rock-text">{data.section.title}</h1>

          <SectionFields section={data.section} />

          <div>
            <h2 className="text-lg font-bold text-rock-text mb-1">
              Entradas ({data.entries.length})
            </h2>
            <p className="text-gray-500 text-sm mb-3">
              Se ordenan solas por fecha de edición del disco.
            </p>
            {data.entries.length === 0 ? (
              <p className="text-gray-500 text-sm">Todavía no hay entradas.</p>
            ) : (
              <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
                {data.entries.map(e => <EntryRow key={e.id} entry={e} />)}
              </div>
            )}
          </div>

          <Suggestions collection={data.collection} section={data.section} />

          <NewNarrativeForm collection={data.collection} section={data.section} />
        </div>
      )}
    </RequireEditor>
  )
}
