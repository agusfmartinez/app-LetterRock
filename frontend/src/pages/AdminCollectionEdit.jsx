import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useConfirm } from '../components/common/ConfirmDialog'
import ImageField from '../components/common/ImageField'
import PlaylistField from '../components/common/PlaylistField'
import RequireCollectionOwner from '../components/common/RequireCollectionOwner'
import {
  AlbumSearchPanel,
  EntriesFlat,
  EntryEditor,
  NewNarrativeForm,
} from '../components/common/CollectionEntryEditor'
import { useCollectionAdmin } from '../hooks/useCollectionAdmin'
import { useCollection } from '../hooks/useCollections'

function CollectionFields({ collection }) {
  const navigate = useNavigate()
  const { updateCollection, deleteCollection } = useCollectionAdmin()
  const confirm = useConfirm()
  const [title, setTitle] = useState(collection.title)
  const [description, setDescription] = useState(collection.description || '')
  const [coverUrl, setCoverUrl] = useState(collection.cover_url || '')
  const [playlistUrl, setPlaylistUrl] = useState(collection.playlist_url || '')
  const [error, setError] = useState('')

  const dirty =
    title !== collection.title ||
    description !== (collection.description || '') ||
    coverUrl !== (collection.cover_url || '') ||
    playlistUrl !== (collection.playlist_url || '')

  const save = () => {
    updateCollection.mutate(
      {
        id: collection.id,
        title: title.trim(),
        description: description.trim() || null,
        cover_url: coverUrl.trim() || null,
        playlist_url: playlistUrl.trim() || null,
      },
      { onError: e => setError(e.message) }
    )
  }

  const togglePublished = () => {
    updateCollection.mutate(
      { id: collection.id, is_published: !collection.is_published },
      { onError: e => setError(e.message) }
    )
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Borrar colección',
      message: `¿Borrar "${collection.title}" con todas sus secciones y entradas? No se puede deshacer.`,
    })
    if (!ok) return
    deleteCollection.mutate(collection.id, {
      onSuccess: () => navigate('/colecciones'),
      onError: e => setError(e.message),
    })
  }

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-rock-text focus:outline-none focus:border-rock-accent"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Descripción"
        rows={3}
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />
      <ImageField
        value={coverUrl}
        onChange={setCoverUrl}
        folder="collections"
        placeholder="URL de portada (opcional)"
      />
      <PlaylistField value={playlistUrl} onChange={setPlaylistUrl} />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={save}
          disabled={!dirty || updateCollection.isPending}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          onClick={togglePublished}
          disabled={updateCollection.isPending}
          className="border border-rock-border text-rock-text px-4 py-1.5 rounded text-sm hover:border-rock-accent"
        >
          {collection.is_published ? 'Pasar a borrador' : 'Publicar'}
        </button>
        <span className="text-xs text-gray-500">
          {collection.is_published ? 'Visible para todos' : 'Sólo la ven los editores'}
        </span>
        <button onClick={remove} className="ml-auto text-sm text-gray-500 hover:text-red-400">
          Borrar colección
        </button>
      </div>
    </div>
  )
}

/** Plegado, como el alta de colección: la mayoría de las visitas vienen a
 *  editar una sección que ya existe, no a crear otra. */
function NewSectionForm({ collection, nextPosition }) {
  const { createSection } = useCollectionAdmin()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    createSection.mutate(
      {
        collection_id: collection.id,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        year_from: yearFrom ? Number(yearFrom) : null,
        year_to: yearTo ? Number(yearTo) : null,
        position: nextPosition,
      },
      {
        onSuccess: () => {
          setTitle('')
          setSubtitle('')
          setYearFrom('')
          setYearTo('')
          setError('')
          setOpen(false)
        },
        onError: (err) => setError(err.message),
      }
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-gray-500 hover:text-rock-accent">
        + Nueva sección
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <h3 className="font-bold text-rock-text text-sm">Nueva sección</h3>
      <div className="flex gap-2 flex-wrap">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Título (ej: Los 70)"
          className="flex-1 min-w-[160px] bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
        />
        <input
          value={yearFrom}
          onChange={e => setYearFrom(e.target.value)}
          placeholder="Desde"
          type="number"
          className="w-24 bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500"
        />
        <input
          value={yearTo}
          onChange={e => setYearTo(e.target.value)}
          placeholder="Hasta"
          type="number"
          className="w-24 bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500"
        />
      </div>
      <input
        value={subtitle}
        onChange={e => setSubtitle(e.target.value)}
        placeholder="Bajada (opcional)"
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />
      <p className="text-gray-600 text-xs">
        El rango de años alimenta las sugerencias de discos al cargar la sección.
      </p>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={createSection.isPending || !title.trim()}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Agregar sección
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:text-rock-text"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

function SectionRow({ collection, section }) {
  const { deleteSection } = useCollectionAdmin()
  const confirm = useConfirm()

  const remove = async () => {
    const ok = await confirm({
      title: 'Borrar sección',
      message: `¿Borrar la sección "${section.title}" y sus ${section.entry_count} entradas? No se puede deshacer.`,
    })
    if (!ok) return
    deleteSection.mutate(section.id)
  }

  return (
    <div className="flex items-center gap-3 p-3">
      <span className="text-gray-600 text-sm w-6 text-right">{section.position}</span>
      <div className="flex-1 min-w-0">
        <Link
          to={`/coleccion/${collection.slug}/${section.slug}/editar`}
          className="text-rock-text hover:text-rock-accent font-medium"
        >
          {section.title}
        </Link>
        <p className="text-gray-500 text-xs">
          {section.year_from && section.year_to ? `${section.year_from}–${section.year_to} · ` : ''}
          {section.entry_count} {section.entry_count === 1 ? 'entrada' : 'entradas'}
        </p>
      </div>
      <Link
        to={`/coleccion/${collection.slug}/${section.slug}/editar`}
        className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent"
      >
        Editar
      </Link>
      <Link
        to={`/coleccion/${collection.slug}/${section.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-500 hover:text-rock-accent text-sm"
      >
        Ver →
      </Link>
      <button onClick={remove} className="text-gray-500 hover:text-red-400 text-sm">
        Borrar
      </button>
    </div>
  )
}


/**
 * Carga de una colección sin épocas.
 *
 * Es la misma mecánica que la pantalla de sección —listado a la izquierda,
 * edición y buscador a la derecha— pero sobre la colección entera: una lista o
 * un ranking no se dividen en décadas, se leen de corrido.
 */
function FlatEntriesEditor({ collection, entries, sections }) {
  const [selectedId, setSelectedId] = useState(null)
  const selected = entries.find(e => e.id === selectedId) || null
  const isRanking = collection.type === 'ranking'
  const { flattenCollection, setRanks } = useCollectionAdmin()
  const confirm = useConfirm()

  // Las entradas cargadas antes de que el ranking numerara solo quedaron sin
  // puesto, y sin número un ranking no es un ranking.
  const needsNumbering = isRanking && entries.some(e => e.rank == null)

  // Restos de cuando lista y ranking eran una timeline disfrazada.
  const inSections = entries.some(e => e.section_id) || sections.length > 0

  const flatten = async () => {
    const ok = await confirm({
      title: 'Sacar de las épocas',
      message:
        'Los discos salen de sus épocas y quedan como una sola secuencia. Se borran las épocas, no los discos.',
      confirmLabel: 'Sacar',
    })
    if (ok) flattenCollection.mutate(collection.id)
  }

  // Si la entrada abierta se borró, cerrar el panel.
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null)
  }, [selectedId, selected])

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      <div className="flex-1 min-w-0 space-y-4">
        {inSections && (
          <div className="border border-rock-border rounded-lg p-3 text-sm">
            <p className="text-gray-400">
              Esta colección tiene épocas, que son de las timelines. Acá los discos
              van en una sola secuencia.
            </p>
            <button
              onClick={flatten}
              disabled={flattenCollection.isPending}
              className="text-rock-accent hover:underline text-xs mt-1 disabled:opacity-50"
            >
              Sacar los discos de las épocas →
            </button>
          </div>
        )}

        <div>
          <h2 className="text-lg font-bold text-rock-text mb-1">
            {isRanking ? 'Puestos' : 'Entradas'} ({entries.length})
          </h2>
          <p className="text-gray-500 text-sm mb-3">
            {isRanking
              ? 'Ordenadas por puesto. El número se edita en el panel de la derecha; las que no tienen puesto van al final.'
              : 'En el orden que elijas. Movelas con las flechas.'}
          </p>
          {needsNumbering && (
            <button
              onClick={() => setRanks.mutate(entries)}
              disabled={setRanks.isPending}
              className="text-rock-accent hover:underline text-xs mb-2 disabled:opacity-50"
            >
              Numerar de 1 a {entries.length} →
            </button>
          )}
          <EntriesFlat
            entries={entries}
            selectedId={selectedId}
            onSelect={id => setSelectedId(id === selectedId ? null : id)}
            isRanking={isRanking}
          />
        </div>

        <NewNarrativeForm collection={collection} entries={entries} isRanking={isRanking} />
      </div>

      <aside className="w-full lg:w-96 lg:flex-shrink-0 lg:sticky lg:top-24 space-y-4">
        {selected && (
          <EntryEditor
            // El puesto entra en la key: al reordenar, el formulario tiene que
            // volver a arrancar del número nuevo y no del que quedó tipeado.
            key={`${selected.id}-${selected.rank ?? ''}`}
            entry={selected}
            isRanking={isRanking}
            siblings={entries}
            onClose={() => setSelectedId(null)}
          />
        )}
        <AlbumSearchPanel collection={collection} entries={entries} isRanking={isRanking} />
      </aside>
    </div>
  )
}

export default function AdminCollectionEdit() {
  const { slug } = useParams()
  const { data, isLoading } = useCollection(slug)

  return (
    <>
      {isLoading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : !data ? (
        <p className="text-red-400">Colección no encontrada.</p>
      ) : (
        <RequireCollectionOwner collection={data.collection}>
        <div className={`space-y-6 ${data.collection.type === 'timeline' ? 'max-w-3xl' : ''}`}>
          <div className="flex items-center gap-4 flex-wrap">
            <Link to="/colecciones" className="text-gray-400 hover:text-rock-accent text-sm">
              ← Colecciones
            </Link>
            <Link
              to={`/coleccion/${data.collection.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-rock-accent text-sm ml-auto"
            >
              Ver la página →
            </Link>
          </div>

          <CollectionFields collection={data.collection} />

          {data.collection.type === 'timeline' ? (
            <div>
              <h2 className="text-lg font-bold text-rock-text mb-3">Épocas</h2>
              {data.sections.length > 0 && (
                <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border mb-4">
                  {data.sections.map(s => (
                    <SectionRow key={s.id} collection={data.collection} section={s} />
                  ))}
                </div>
              )}
              <NewSectionForm collection={data.collection} nextPosition={data.sections.length + 1} />
            </div>
          ) : (
            <FlatEntriesEditor
              collection={data.collection}
              entries={data.entries}
              sections={data.sections}
            />
          )}
        </div>
        </RequireCollectionOwner>
      )}
    </>
  )
}
