import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfirm } from '../components/common/ConfirmDialog'
import RequireEditor from '../components/common/RequireEditor'
import { useCollectionAdmin, slugify } from '../hooks/useCollectionAdmin'
import { useCollections } from '../hooks/useCollections'
import { useAuthStore } from '../store/authStore'

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
      <button onClick={() => setOpen(true)} className="text-sm text-gray-500 hover:text-rock-accent">
        + Nueva colección
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <h2 className="font-bold text-rock-text">Nueva colección</h2>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Título"
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />
      {title && <p className="text-gray-600 text-xs">/coleccion/{slugify(title)}</p>}
      <select
        value={type}
        onChange={e => setType(e.target.value)}
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text"
      >
        {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Descripción"
        rows={2}
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={createCollection.isPending || !title.trim()}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Crear
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
        className={`text-xs border rounded px-2 py-1 disabled:opacity-50 ${
          collection.is_official
            ? 'border-rock-accent text-rock-accent'
            : 'border-rock-border text-gray-500 hover:text-rock-accent hover:border-rock-accent'
        }`}
      >
        {collection.is_official ? 'De la app' : 'Fijar'}
      </button>
      <button
        onClick={toggleHidden}
        disabled={updateCollection.isPending}
        className="text-xs text-gray-500 hover:text-red-400 disabled:opacity-50"
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
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-rock-text">Colecciones</h1>
          <p className="text-gray-500 text-sm mt-1">
            Todas las del sitio, propias y de la comunidad. "Fijar" las manda
            arriba del índice como colecciones de LetterRock; "Ocultar" las baja
            sin borrarlas.
          </p>
        </div>

        {isLoading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : collections.length === 0 ? (
          <p className="text-gray-500 text-sm">Todavía no hay colecciones.</p>
        ) : (
          <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
            {collections.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/coleccion/${c.slug}/editar`}
                    className={`font-medium hover:text-rock-accent ${
                      c.hidden ? 'text-gray-500 line-through' : 'text-rock-text'
                    }`}
                  >
                    {c.title}
                  </Link>
                  <p className="text-gray-500 text-xs">
                    {[c.type, `/${c.slug}`, c.author ? `por ${c.author.username}` : 'de la app']
                      .join(' · ')}
                  </p>
                </div>
                {!c.is_published && (
                  <span className="text-xs uppercase tracking-widest text-gray-500 border border-rock-border rounded px-2 py-0.5">
                    Borrador
                  </span>
                )}
                <ModerationButtons collection={c} />
                <Link
                  to={`/coleccion/${c.slug}/editar`}
                  className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent"
                >
                  Editar
                </Link>
                <Link
                  to={`/coleccion/${c.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-rock-accent text-sm"
                >
                  Ver →
                </Link>
              </div>
            ))}
          </div>
        )}

        <NewCollectionForm />
      </div>
    </RequireEditor>
  )
}
