import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCollectionAdmin } from '../hooks/useCollectionAdmin'
import { useCollections } from '../hooks/useCollections'
import { useRole } from '../hooks/useRole'
import { useAuthStore } from '../store/authStore'

const TYPES = [
  { value: 'timeline', label: 'Timeline (por épocas)' },
  { value: 'list', label: 'Lista (orden libre)' },
  { value: 'ranking', label: 'Ranking (numerado)' },
]

const TYPE_LABEL = {
  timeline: 'Timeline',
  list: 'Lista',
  ranking: 'Ranking',
}

/**
 * Sólo ordena el bloque de la comunidad. Las de la app van fijadas arriba y en
 * el orden que decidió el editor: son la portada del sitio, no un resultado de
 * búsqueda que cada visitante acomoda como quiere.
 */
const SORTS = {
  recent: {
    label: 'Más recientes',
    compare: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
  },
  oldest: {
    label: 'Más antiguas',
    compare: (a, b) => String(a.created_at).localeCompare(String(b.created_at)),
  },
  name: {
    label: 'Alfabético',
    compare: (a, b) => a.title.localeCompare(b.title, 'es'),
  },
}

const SORT_KEY = 'letterrock:collections-sort'

/** La preferencia es de este visitante y de este navegador; si falla, no importa. */
function readSort() {
  try {
    const stored = localStorage.getItem(SORT_KEY)
    return stored && SORTS[stored] ? stored : 'recent'
  } catch {
    return 'recent'
  }
}


/**
 * Alta desde la página pública: crear una colección dejó de ser cosa del panel.
 *
 * Nace como borrador —`is_published` arranca en FALSE— así que nadie la ve hasta
 * que su dueño la publica. Es lo que permite armarla tranquilo antes de mostrarla.
 */
function NewCollectionButton() {
  const navigate = useNavigate()
  const { createCollection } = useCollectionAdmin()
  const user = useAuthStore(s => s.user)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('list')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    createCollection.mutate(
      { title: title.trim(), type, created_by: user.id },
      {
        onSuccess: (created) => navigate(`/coleccion/${created.slug}/editar`),
        onError: (err) => setError(err.message),
      }
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-rock-accent hover:underline">
        + Armar la mía
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="w-full bg-rock-card border border-rock-border rounded-lg p-4 space-y-3 mt-3">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Título (ej: Los diez que me cambiaron la cabeza)"
        autoFocus
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />
      <select
        value={type}
        onChange={e => setType(e.target.value)}
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text"
      >
        {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={createCollection.isPending || !title.trim()}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Crear
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-rock-text">
          Cancelar
        </button>
        <span className="text-xs text-gray-600">Nace como borrador: sólo la ves vos.</span>
      </div>
    </form>
  )
}

export function CollectionCard({ collection }) {
  const count = collection.section_count

  return (
    <Link
      to={`/coleccion/${collection.slug}`}
      className="group bg-rock-card border border-rock-border rounded-lg overflow-hidden hover:border-rock-accent transition-colors flex flex-col"
    >
      <div className="aspect-[16/9] bg-rock-dark overflow-hidden">
        {collection.cover_url ? (
          <img
            src={collection.cover_url}
            alt={collection.title}
            loading="lazy"
            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center px-4 text-center">
            <span className="text-2xl font-black text-rock-border group-hover:text-rock-accent transition-colors">
              {collection.title}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="text-xl font-bold text-rock-text group-hover:text-rock-accent transition-colors">
            {collection.title}
          </h2>
          {/* Un editor ve también lo que no está publicado, y necesita saber
              cuál es cuál sin entrar. */}
          {!collection.is_published && (
            <span className="text-[10px] uppercase tracking-widest text-rock-accent border border-rock-accent rounded px-1.5 py-0.5">
              Borrador
            </span>
          )}
          {collection.hidden && (
            <span className="text-[10px] uppercase tracking-widest text-red-400 border border-red-400 rounded px-1.5 py-0.5">
              Oculta
            </span>
          )}
        </div>

        {collection.author && (
          <p className="text-gray-500 text-xs mt-1">por {collection.author.username}</p>
        )}

        {collection.description && (
          <p className="text-gray-400 text-sm mt-2 leading-relaxed line-clamp-3">
            {collection.description}
          </p>
        )}

        <p className="text-gray-600 text-xs mt-auto pt-3">
          {[
            TYPE_LABEL[collection.type] || null,
            collection.type === 'timeline'
              ? count === 0
                ? 'sin épocas todavía'
                : `${count} ${count === 1 ? 'época' : 'épocas'}`
              : null,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Link>
  )
}

/**
 * Índice de colecciones.
 *
 * Antes no existía: el Navbar llevaba directo a "Historia del rock argentino"
 * con el slug escrito a mano, así que a una segunda colección no había forma de
 * llegar salvo tipeando la URL.
 */
export default function Collections() {
  const { data: collections = [], isLoading } = useCollections()
  const { isEditor } = useRole()
  const user = useAuthStore(s => s.user)
  const [sort, setSort] = useState(readSort)


  /*
   * RLS le devuelve al editor y al dueño también lo oculto, así que el filtro va
   * acá: una colección bajada no vuelve al índice por el hecho de que la mire
   * quien la moderó. Su dueño sí la sigue viendo, con el cartel de "Oculta",
   * porque si no perdería la única forma de llegar a ella.
   */
  const listed = collections.filter(c => !c.hidden || c.created_by === user?.id)
  const official = listed.filter(c => c.is_official)

  // Se ordena acá y no en la consulta: son unas pocas filas que ya están en
  // memoria, y cambiar el orden no debería costar una ida a la base.
  const community = useMemo(
    () => listed.filter(c => !c.is_official).sort(SORTS[sort].compare),
    [listed, sort]
  )

  const changeSort = (value) => {
    setSort(value)
    try { localStorage.setItem(SORT_KEY, value) } catch { /* sin persistir */ }
  }

  return (
    <div className="space-y-10">
      <header>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-rock-text">Colecciones</h1>
          {isEditor && (
            <Link to="/admin/colecciones" className="text-sm text-gray-500 hover:text-rock-accent">
              Administrar
            </Link>
          )}
          {user && <NewCollectionButton />}
        </div>
        <p className="text-gray-500 text-sm mt-2 max-w-2xl">
          Recorridos armados a mano: la historia disco por disco, listas y rankings.
          Cualquiera puede armar los suyos.
        </p>
      </header>

      {isLoading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <>
          {official.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                De LetterRock
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {official.map(c => <CollectionCard key={c.id} collection={c} />)}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-baseline gap-4 flex-wrap">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                De la comunidad
              </h2>
              {/* El selector es sólo de este bloque: las de la app van fijadas
                  arriba en el orden que eligió el editor. */}
              {community.length > 1 && (
                <select
                  value={sort}
                  onChange={e => changeSort(e.target.value)}
                  aria-label="Ordenar colecciones de la comunidad"
                  className="ml-auto bg-rock-dark border border-rock-border rounded px-3 py-1.5 text-sm text-rock-text focus:outline-none focus:border-rock-accent"
                >
                  {Object.entries(SORTS).map(([value, { label }]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              )}
            </div>

            {community.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Todavía nadie armó la suya.{' '}
                {user
                  ? 'Podés ser el primero.'
                  : <Link to="/auth/login" className="text-rock-accent hover:underline">Entrá para armar una →</Link>}
              </p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {community.map(c => <CollectionCard key={c.id} collection={c} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
