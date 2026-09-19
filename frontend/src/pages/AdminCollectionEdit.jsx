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
import { SkeletonPanel } from '../components/common/States'
import ArrowLink from '../components/common/ArrowLink'
import RowMenu from '../components/common/RowMenu'

const LABEL = 'block text-[13px] text-gray-400 mb-1.5'

/**
 * Cabecera de la ficha: el título, en qué estado está y lo que se hace sobre la
 * colección entera.
 *
 * Publicar va a la vista, al lado del estado: es lo que cambia qué ve la gente.
 * Borrar va al menú "⋯": no se deshace, y como texto suelto al final del
 * formulario quedaba al alcance de un clic distraído y sin forma de botón.
 */
function CollectionHeader({ collection }) {
  const navigate = useNavigate()
  const { updateCollection, deleteCollection } = useCollectionAdmin()
  const confirm = useConfirm()
  const [error, setError] = useState('')
  const published = collection.is_published

  const togglePublished = () => {
    updateCollection.mutate(
      { id: collection.id, is_published: !published },
      { onError: e => setError(e.message) }
    )
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Borrar colección',
      message: `¿Borrar "${collection.title}" con todas sus secciones y entradas? No se puede deshacer.`,
      confirmLabel: 'Borrar',
    })
    if (!ok) return
    deleteCollection.mutate(collection.id, {
      onSuccess: () => navigate('/colecciones'),
      onError: e => setError(e.message),
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display text-3xl sm:text-4xl">{collection.title}</h1>
        <span className={`tag ${published ? 'tag-accent' : 'tag-outline'}`}>
          {published ? 'Publicada' : 'Borrador'}
        </span>
        {collection.is_official && <span className="tag tag-neutral">De LetterRock</span>}
        {collection.hidden && <span className="tag tag-neutral">Oculta</span>}

        <div className="flex items-center gap-2 ml-auto">
          {/* Publicar va a la vista mientras es borrador: es lo que falta
              hacer. Ya publicada, volver a borrador es raro y va al menú. */}
          {!published && (
            <button
              onClick={togglePublished}
              disabled={updateCollection.isPending}
              className="btn btn-primary !min-h-0 !px-4 !py-2 !text-[13px]"
            >
              Publicar
            </button>
          )}
          <RowMenu
            disabled={deleteCollection.isPending || updateCollection.isPending}
            items={[
              ...(published ? [{
                label: 'Pasar a borrador',
                hint: 'Sale del índice hasta que la vuelvas a publicar.',
                onClick: togglePublished,
              }] : []),
              {
                label: 'Borrar colección',
                hint: 'Con todas sus secciones y entradas. No se puede deshacer.',
                onClick: remove,
                danger: true,
              },
            ]}
          />
        </div>
      </div>

      {/* Qué significa el estado, dicho una vez y al lado del estado. */}
      <p className="text-[13px] text-gray-500">
        {published
          ? 'La ve todo el mundo en el índice de colecciones.'
          : 'Todavía no aparece en el índice: sólo la ven quien la armó y los editores.'}
      </p>
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

function CollectionFields({ collection }) {
  const { updateCollection } = useCollectionAdmin()
  const [title, setTitle] = useState(collection.title)
  const [description, setDescription] = useState(collection.description || '')
  const [coverUrl, setCoverUrl] = useState(collection.cover_url || '')
  const [playlistUrl, setPlaylistUrl] = useState(collection.playlist_url || '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

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
      { onSuccess: () => { setError(''); setSaved(true) }, onError: e => setError(e.message) }
    )
  }

  const touch = (fn) => (v) => { setSaved(false); fn(v) }

  return (
    <div className="card space-y-4">
      <h2 className="font-display text-xl">Datos</h2>

      {/* En escritorio, el texto a la izquierda y lo que se engancha (portada
          y playlist) a la derecha. En el teléfono, uno debajo del otro. */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <label className="block">
            <span className={LABEL}>Título</span>
            <input value={title} onChange={e => touch(setTitle)(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className={LABEL}>Descripción</span>
            <textarea
              value={description}
              onChange={e => touch(setDescription)(e.target.value)}
              placeholder="De qué se trata la colección"
              rows={4}
              className="input"
            />
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <span className={LABEL}>Portada</span>
            <ImageField
              value={coverUrl}
              onChange={touch(setCoverUrl)}
              folder="collections"
              placeholder="URL de portada (opcional)"
            />
          </div>
          <div>
            <span className={LABEL}>Playlist</span>
            <PlaylistField value={playlistUrl} onChange={touch(setPlaylistUrl)} />
          </div>
        </div>
      </div>

      {error && <p className="field-error">{error}</p>}

      <div className="flex items-center gap-3 justify-end border-t border-rock-border pt-4">
        {saved && !dirty && <span className="text-xs text-gray-500">Guardado</span>}
        <button
          onClick={save}
          disabled={!dirty || updateCollection.isPending}
          className="btn btn-primary px-7"
        >
          Guardar
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
      <button onClick={() => setOpen(true)} className="btn btn-secondary !min-h-0 !px-4 !py-2 !text-[13px]">
        + Nueva sección
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h3 className="font-display text-xl">Nueva sección</h3>
      <div className="flex gap-2 flex-wrap">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Título (ej: Los 70)"
          className="input flex-1 min-w-[160px]"
        />
        <input
          value={yearFrom}
          onChange={e => setYearFrom(e.target.value)}
          placeholder="Desde"
          type="number"
          className="input !w-24 text-sm text-rock-text placeholder-gray-500"
        />
        <input
          value={yearTo}
          onChange={e => setYearTo(e.target.value)}
          placeholder="Hasta"
          type="number"
          className="input !w-24 text-sm text-rock-text placeholder-gray-500"
        />
      </div>
      <input
        value={subtitle}
        onChange={e => setSubtitle(e.target.value)}
        placeholder="Bajada (opcional)"
        className="input"
      />
      <p className="text-gray-500 text-xs">
        El rango de años alimenta las sugerencias de discos al cargar la sección.
      </p>
      {error && <p className="text-rock-accentBright text-sm">{error}</p>}
      <div className="flex items-center gap-3 justify-end">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={createSection.isPending || !title.trim()}
          className="btn btn-primary"
        >
          Agregar sección
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
    <div className="flex items-center gap-3.5 px-4 sm:px-5 py-3.5 border-t border-rock-border first:border-t-0">
      <span className="font-mono text-gray-500 text-xs w-6 text-right flex-none">{section.position}</span>
      <div className="flex-1 min-w-0">
        <Link
          to={`/coleccion/${collection.slug}/${section.slug}/editar`}
          className="text-[15px] font-semibold hover:text-rock-accent"
        >
          {section.title}
        </Link>
        <p className="text-gray-500 text-[12.5px] mt-0.5">
          {section.year_from && section.year_to ? `${section.year_from}–${section.year_to} · ` : ''}
          {section.entry_count} {section.entry_count === 1 ? 'entrada' : 'entradas'}
        </p>
      </div>
      <Link
        to={`/coleccion/${collection.slug}/${section.slug}/editar`}
        className="btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px] hidden sm:inline-flex"
      >
        Editar
      </Link>
      <ArrowLink to={`/coleccion/${collection.slug}/${section.slug}`} target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex">
        Ver
      </ArrowLink>
      <RowMenu
        disabled={deleteSection.isPending}
        items={[{
          label: 'Borrar sección',
          hint: 'Con sus entradas. No se puede deshacer.',
          onClick: remove,
          danger: true,
        }]}
      />
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
          <div className="bg-rock-card rounded-xl p-3 text-sm">
            <p className="text-gray-400">
              Esta colección tiene épocas, que son de las timelines. Acá los discos
              van en una sola secuencia.
            </p>
            <button
              onClick={flatten}
              disabled={flattenCollection.isPending}
              className="btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px] mt-2"
            >
              Sacar los discos de las épocas
            </button>
          </div>
        )}

        <div>
          <h2 className="font-display text-xl mb-1">
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
              className="btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px] mb-2"
            >
              Numerar de 1 a {entries.length}
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
        <SkeletonPanel />
      ) : !data ? (
        <p className="text-rock-accentBright">Colección no encontrada.</p>
      ) : (
        <RequireCollectionOwner collection={data.collection}>
        <div className={`space-y-6 ${data.collection.type === 'timeline' ? 'max-w-3xl' : ''}`}>
          <div className="flex items-center gap-3">
            <ArrowLink back to="/colecciones">Colecciones</ArrowLink>
            <ArrowLink to={`/coleccion/${data.collection.slug}`} target="_blank" rel="noopener noreferrer" className="ml-auto">Ver la página</ArrowLink>
          </div>

          <CollectionHeader collection={data.collection} />

          <CollectionFields key={data.collection.id} collection={data.collection} />

          {data.collection.type === 'timeline' ? (
            <div>
              <h2 className="font-display text-2xl mb-3">Épocas ({data.sections.length})</h2>
              {data.sections.length > 0 && (
                // Sin overflow-hidden: el menú "⋯" de la última fila sale por abajo.
                <div className="card !p-0 mb-4">
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
