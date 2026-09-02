import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useConfirm } from '../components/common/ConfirmDialog'
import ImageField from '../components/common/ImageField'
import PlaylistField from '../components/common/PlaylistField'
import {
  AlbumSearchPanel,
  EntriesByYear,
  EntryEditor,
  NewNarrativeForm,
} from '../components/common/CollectionEntryEditor'
import RequireCollectionOwner from '../components/common/RequireCollectionOwner'
import {
  describeError,
  EMPTY_ALBUM_FILTERS,
  useAlbumSearch,
  useCollectionAdmin,
} from '../hooks/useCollectionAdmin'
import { groupEntriesByYear, nextPositionInYear, useCollectionSection } from '../hooks/useCollections'
import { albumYear, formatReleaseDate } from '../services/dates'
import { linkAlbumToYoutube, linkArtistDiscography, refreshYoutubeViews } from '../services/api'

const INPUT = 'bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent'

function SectionFields({ section }) {
  const { updateSection } = useCollectionAdmin()
  const [form, setForm] = useState({
    title: section.title,
    subtitle: section.subtitle || '',
    intro_text: section.intro_text || '',
    cover_url: section.cover_url || '',
    playlist_url: section.playlist_url || '',
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
        playlist_url: form.playlist_url.trim() || null,
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
      <ImageField
        value={form.cover_url}
        onChange={url => setForm(f => ({ ...f, cover_url: url }))}
        folder="collections"
        placeholder="URL de portada de la sección (opcional)"
      />
      <PlaylistField
        value={form.playlist_url}
        onChange={url => setForm(f => ({ ...f, playlist_url: url }))}
      />
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
    <>
      {isLoading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : !data?.section ? (
        <p className="text-red-400">Sección no encontrada.</p>
      ) : (
        <RequireCollectionOwner collection={data.collection}>
        <div className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              to={`/coleccion/${data.collection.slug}/editar`}
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
                  Agrupadas por año, en orden cronológico. Elegí una para editarla
                  en el panel de la derecha, o movela con las flechas para fijar
                  el orden dentro de su año.
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

              <NewNarrativeForm collection={data.collection} section={data.section} entries={entries} />
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
              <AlbumSearchPanel collection={data.collection} section={data.section} entries={entries} />
            </aside>
          </div>
        </div>
        </RequireCollectionOwner>
      )}
    </>
  )
}
