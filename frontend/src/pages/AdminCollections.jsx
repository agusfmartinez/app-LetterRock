import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfirm } from '../components/common/ConfirmDialog'
import RequireEditor from '../components/common/RequireEditor'
import AdminLayout from '../components/common/AdminLayout'
import { EmptyState, SkeletonRows } from '../components/common/States'
import { useCollectionAdmin, slugify } from '../hooks/useCollectionAdmin'
import { useCollections } from '../hooks/useCollections'
import { useAuthStore } from '../store/authStore'
import ArrowLink from '../components/common/ArrowLink'

const TYPES = [
  { value: 'timeline', label: 'Timeline (secciones por época)' },
  { value: 'list', label: 'Lista (orden libre)' },
  { value: 'ranking', label: 'Ranking (con puesto y fuente)' },
]

/**
 * Alta de colección. Plegada por defecto y debajo del listado: crear una es lo
 * excepcional —hay tres o cuatro en total—, y ocupando el lugar de arriba
 * empujaba fuera de la vista lo que uno viene a hacer, que es entrar a editar.
 */
function NewCollectionForm() {
  const { user } = useAuthStore()
  const { createCollection } = useCollectionAdmin()
  const [open, setOpen] = useState(false)
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
        onSuccess: () => { setTitle(''); setDescription(''); setError(''); setOpen(false) },
        onError: (err) => setError(err.message),
      }
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-secondary">
        + Nueva colección
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <p className="font-mono text-[9.5px] tracking-[0.16em] text-gray-500">NUEVA COLECCIÓN</p>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Título"
        className="input"
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
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={createCollection.isPending || !title.trim()}
          className="btn btn-primary"
        >
          Crear
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn btn-secondary"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}


/**
 * Moderación: fijar arriba del índice y bajar del sitio.
 *
 * Las dos son de editor y RLS lo hace cumplir con un trigger, no con la policy
 * de UPDATE: esa no puede comparar el valor viejo con el nuevo, así que el dueño
 * de una colección podría marcarse como oficial o desocultarse solo.
 *
 * Ocultar no borra, igual que en el catálogo de artistas: baja la colección del
 * índice pero su dueño la sigue viendo, y se puede revertir.
 */
function ModerationButtons({ collection }) {
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
    <>
      <button
        onClick={toggleOfficial}
        disabled={updateCollection.isPending}
        title={collection.is_official ? 'Sacar de las de la app' : 'Fijar como de la app'}
        className={`btn !min-h-0 !px-3 !py-1.5 !text-[12.5px] ${
          collection.is_official
            ? 'border-rock-accent text-rock-accent'
            : 'btn-secondary !text-gray-400'
        }`}
      >
        {collection.is_official ? 'De la app' : 'Fijar'}
      </button>
      <button
        onClick={toggleHidden}
        disabled={updateCollection.isPending}
        className="btn btn-ghost !min-h-0 !text-[12.5px] !text-gray-400 hover:!text-rock-accentBright"
      >
        {collection.hidden ? 'Restaurar' : 'Ocultar'}
      </button>
    </>
  )
}

export default function AdminCollections() {
  const { data: collections = [], isLoading } = useCollections()

  return (
    <RequireEditor>
      <AdminLayout
        title="Panel"
        lead={'Todas las colecciones del sitio, propias y de la comunidad. «Fijar» las manda arriba del índice como colecciones de LetterRock; «Ocultar» las baja sin borrarlas.'}
      >
        {isLoading ? (
          <SkeletonRows count={4} avatar={false} />
        ) : collections.length === 0 ? (
          <EmptyState title="Todavía no hay colecciones">
            Creá la primera con el botón de abajo.
          </EmptyState>
        ) : (
          <div className="card !p-0 overflow-hidden mb-5">
            {collections.map(c => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-5 py-4 flex-wrap border-t border-rock-border first:border-t-0"
              >
                <div className="flex-1 min-w-[200px]">
                  <Link
                    to={`/coleccion/${c.slug}/editar`}
                    className={`text-[14.5px] font-semibold hover:text-rock-accent ${
                      c.hidden ? 'text-gray-500 line-through' : ''
                    }`}
                  >
                    {c.title}
                  </Link>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {[c.type, `/${c.slug}`, c.author ? `por ${c.author.username}` : 'de la app']
                      .join(' · ')}
                  </p>
                </div>
                {!c.is_published && <span className="tag tag-outline">Borrador</span>}
                <ModerationButtons collection={c} />
                <Link
                  to={`/coleccion/${c.slug}/editar`}
                  className="btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px]"
                >
                  Editar
                </Link>
                <ArrowLink to={`/coleccion/${c.slug}`} target="_blank" rel="noopener noreferrer">Ver</ArrowLink>
              </div>
            ))}
          </div>
        )}

        <NewCollectionForm />
      </AdminLayout>
    </RequireEditor>
  )
}
