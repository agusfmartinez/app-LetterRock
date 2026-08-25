import { useState } from 'react'
import { Link } from 'react-router-dom'
import RequireEditor from '../components/common/RequireEditor'
import { useCollectionAdmin, slugify } from '../hooks/useCollectionAdmin'
import { useCollections } from '../hooks/useCollections'
import { useAuthStore } from '../store/authStore'

const TYPES = [
  { value: 'timeline', label: 'Timeline (secciones por época)' },
  { value: 'list', label: 'Lista (orden libre)' },
  { value: 'ranking', label: 'Ranking (con puesto y fuente)' },
]

function NewCollectionForm() {
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
        onSuccess: () => { setTitle(''); setDescription(''); setError('') },
        onError: (err) => setError(err.message),
      }
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
      <button
        type="submit"
        disabled={createCollection.isPending || !title.trim()}
        className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        Crear
      </button>
    </form>
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
            Timelines, listas y rankings. Sólo lo publicado se ve desde afuera.
          </p>
        </div>

        <NewCollectionForm />

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
                    to={`/admin/coleccion/${c.slug}`}
                    className="text-rock-text hover:text-rock-accent font-medium"
                  >
                    {c.title}
                  </Link>
                  <p className="text-gray-500 text-xs">{c.type} · /{c.slug}</p>
                </div>
                {!c.is_published && (
                  <span className="text-xs uppercase tracking-widest text-gray-500 border border-rock-border rounded px-2 py-0.5">
                    Borrador
                  </span>
                )}
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
      </div>
    </RequireEditor>
  )
}
