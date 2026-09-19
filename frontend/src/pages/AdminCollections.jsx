import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfirm } from '../components/common/ConfirmDialog'
import RequireEditor from '../components/common/RequireEditor'
import AdminLayout from '../components/common/AdminLayout'
import { EmptyState, SkeletonRows } from '../components/common/States'
import { IconLayers, IconPlus } from '../components/common/Icons'
import RowMenu from '../components/common/RowMenu'
import { useCollectionAdmin, slugify } from '../hooks/useCollectionAdmin'
import { useCollections } from '../hooks/useCollections'
import { useAuthStore } from '../store/authStore'
import ArrowLink from '../components/common/ArrowLink'

const TYPES = [
  { value: 'timeline', label: 'Timeline (secciones por época)' },
  { value: 'list', label: 'Lista (orden libre)' },
  { value: 'ranking', label: 'Ranking (con puesto y fuente)' },
]

// El tipo en castellano: en la base es `timeline`, `list`, `ranking`.
const TYPE_NAME = { timeline: 'Línea de tiempo', list: 'Lista', ranking: 'Ranking' }

/*
 * Qué se ve de la lista. "Comunidad" son las que no marcó la app, sin importar
 * quién las haya creado.
 */
const FILTERS = [
  { value: 'all', label: 'Todas', test: () => true },
  { value: 'official', label: 'De LetterRock', test: c => c.is_official },
  { value: 'community', label: 'Comunidad', test: c => !c.is_official },
  { value: 'drafts', label: 'Borradores', test: c => !c.is_published },
  { value: 'hidden', label: 'Ocultas', test: c => c.hidden },
]

/**
 * Alta de colección. Se abre desde el botón de la barra, arriba de la lista:
 * crear una es poco frecuente, pero es la acción principal de esta pantalla y
 * al pie de la lista quedaba fuera de la vista.
 */
function NewCollectionForm({ onClose }) {
  const { user } = useAuthStore()
  const { createCollection } = useCollectionAdmin()
  const [title, setTitle] = useState('')
  const [type, setType] = useState('timeline')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    createCollection.mutate(
      { title: title.trim(), type, description: description.trim() || null, created_by: user?.id },
      {
        onSuccess: () => { setTitle(''); setDescription(''); setError(''); onClose() },
        onError: (err) => setError(err.message),
      }
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-3 mb-5 animate-fade-up">
      <p className="kicker">Nueva colección</p>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Título"
        className="input"
        autoFocus
      />
      {title && <p className="font-mono text-gray-500 text-xs">/coleccion/{slugify(title)}</p>}
      <select
        value={type}
        onChange={e => setType(e.target.value)}
        className="input"
      >
        {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Descripción"
        rows={2}
        className="input"
      />
      {error && <p className="field-error">{error}</p>}
      <div className="flex items-center gap-3 flex-wrap justify-end">
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={createCollection.isPending || !title.trim()}
          className="btn btn-primary"
        >
          Crear
        </button>
      </div>
    </form>
  )
}

/**
 * Moderación, en el menú "⋯" de cada fila: marcar como de la app y bajar del
 * sitio. Se usan poco, y como dos botones por fila competían con Editar, que
 * es lo que se viene a hacer.
 *
 * Las dos son de editor y RLS lo hace cumplir con un trigger, no con la policy
 * de UPDATE: esa no puede comparar el valor viejo con el nuevo, así que el dueño
 * de una colección podría marcarse como oficial o desocultarse solo.
 *
 * Ocultar no borra, igual que en el catálogo de artistas: baja la colección del
 * índice pero su dueño la sigue viendo, y se puede revertir.
 */
function ModerationMenu({ collection }) {
  const { updateCollection } = useCollectionAdmin()
  const confirm = useConfirm()

  const toggleOfficial = () => {
    updateCollection.mutate({ id: collection.id, is_official: !collection.is_official })
  }

  const toggleHidden = async () => {
    if (!collection.hidden) {
      const ok = await confirm({
        title: 'Ocultar colección',
        message: `"${collection.title}" deja de aparecer en el índice. Su dueño la sigue viendo y se puede restaurar.`,
        confirmLabel: 'Ocultar',
      })
      if (!ok) return
    }
    updateCollection.mutate({ id: collection.id, hidden: !collection.hidden })
  }

  return (
    <RowMenu
      disabled={updateCollection.isPending}
      items={[
        {
          label: collection.is_official ? 'Quitar "de LetterRock"' : 'Marcar "de LetterRock"',
          hint: collection.is_official ? 'Vuelve al bloque de la comunidad.' : 'Va al bloque de LetterRock.',
          onClick: toggleOfficial,
        },
        {
          label: collection.hidden ? 'Restaurar' : 'Ocultar',
          hint: collection.hidden ? 'Vuelve a aparecer en el índice.' : 'Se oculta del índice.',
          onClick: toggleHidden,
          danger: !collection.hidden,
        },
      ]}
    />
  )
}

function CollectionRow({ c }) {
  const counts = [
    c.type === 'timeline' && c.section_count ? `${c.section_count} ${c.section_count === 1 ? 'época' : 'épocas'}` : null,
    `${c.entry_count} ${c.entry_count === 1 ? 'entrada' : 'entradas'}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="flex items-center gap-4 px-4 sm:px-5 py-3.5 border-t border-rock-border first:border-t-0">
      <div className="w-12 h-12 flex-none rounded-[10px] overflow-hidden bg-rock-border grid place-items-center text-gray-500">
        {c.cover_url
          ? <img src={c.cover_url} alt="" className="w-full h-full object-cover washed" />
          : <IconLayers size={18} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/coleccion/${c.slug}/editar`}
            className={`text-[15px] font-semibold hover:text-rock-accent ${c.hidden ? 'text-gray-500' : ''}`}
          >
            {c.title}
          </Link>
          {/* Estados: etiquetas quietas, no botones. Los cambios van en "⋯". */}
          {c.is_official && <span className="tag tag-accent !text-[10.5px] !py-0.5">De LetterRock</span>}
          {!c.is_published && <span className="tag tag-outline !text-[10.5px] !py-0.5">Borrador</span>}
          {c.hidden && <span className="tag tag-neutral !text-[10.5px] !py-0.5">Oculta</span>}
        </div>
        <p className="text-gray-500 text-[12.5px] mt-0.5 truncate">
          {[TYPE_NAME[c.type] || c.type, counts, c.author ? `por ${c.author.username}` : 'de letterrock'].join(' · ')}
        </p>
      </div>

      <Link
        to={`/coleccion/${c.slug}/editar`}
        className="btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px] hidden sm:inline-flex"
      >
        Editar
      </Link>
      <ArrowLink to={`/coleccion/${c.slug}`} target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex">
        Ver
      </ArrowLink>
      <ModerationMenu collection={c} />
    </div>
  )
}

export default function AdminCollections() {
  const { data: collections = [], isLoading } = useCollections()
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)

  const test = FILTERS.find(f => f.value === filter)?.test || (() => true)
  const shown = collections.filter(test)
  // Los filtros sin nada no se muestran: un "Ocultas (0)" no lleva a ningún lado.
  const filters = FILTERS.filter(f => f.value === 'all' || collections.some(f.test))

  return (
    <RequireEditor>
      <AdminLayout
        title="Panel"
        lead="Todas las colecciones del sitio, propias y de la comunidad."
      >
        <div className="flex items-center gap-3 flex-wrap mb-4">
          {collections.length > 0 && (
            <div className="seg">
              {filters.map(f => (
                <label key={f.value} className="seg-opt">
                  <input
                    type="radio"
                    name="filtro-colecciones"
                    checked={filter === f.value}
                    onChange={() => setFilter(f.value)}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          )}
          {!creating && (
            <button onClick={() => setCreating(true)} className="btn btn-primary ml-auto">
              <IconPlus size={16} /> Nueva colección
            </button>
          )}
        </div>

        {creating && <NewCollectionForm onClose={() => setCreating(false)} />}

        {isLoading ? (
          <SkeletonRows count={4} avatar={false} />
        ) : collections.length === 0 ? (
          <EmptyState title="Todavía no hay colecciones">
            Creá la primera con «Nueva colección».
          </EmptyState>
        ) : shown.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay colecciones con ese filtro.</p>
        ) : (
          // Sin overflow-hidden: el menú "⋯" de la última fila tiene que poder
          // salir por debajo de la tarjeta.
          <div className="card !p-0">
            {shown.map(c => <CollectionRow key={c.id} c={c} />)}
          </div>
        )}
      </AdminLayout>
    </RequireEditor>
  )
}
