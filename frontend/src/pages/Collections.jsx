import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, ErrorState, SkeletonGrid } from '../components/common/States'
import { IconPlus } from '../components/common/Icons'
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
      <button onClick={() => setOpen(true)} className="btn btn-primary px-6 py-3">
        <IconPlus size={15} /> Nueva colección
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="w-full max-w-lg card space-y-3">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Título (ej: Los diez que me cambiaron la cabeza)"
        autoFocus
        className="input"
      />
      <select value={type} onChange={e => setType(e.target.value)} className="input">
        {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      {error && <p className="field-error">{error}</p>}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={createCollection.isPending || !title.trim()}
          className="btn btn-primary"
        >
          Crear
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          Cancelar
        </button>
        <span className="text-xs text-gray-500">Nace como borrador: sólo la ves vos.</span>
      </div>
    </form>
  )
}

/** Los carteles de estado de una colección. */
function StatusTags({ collection }) {
  return (
    <>
      {/* Un editor ve también lo que no está publicado, y necesita saber cuál
          es cuál sin entrar. */}
      {!collection.is_published && <span className="tag tag-outline">Borrador</span>}
      {collection.hidden && <span className="tag tag-accent">Oculta</span>}
    </>
  )
}

/**
 * "Timeline · 7 épocas", "Ranking · 50 discos".
 *
 * Una timeline se mide en épocas y una lista en entradas: contar las entradas
 * de una timeline no dice nada, porque viven repartidas adentro de cada época.
 */
export function collectionMeta(collection) {
  const type = TYPE_LABEL[collection.type] || null
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

  const size = collection.type === 'timeline'
    ? (collection.section_count ? plural(collection.section_count, 'época', 'épocas') : 'sin épocas todavía')
    : (collection.entry_count ? plural(collection.entry_count, 'entrada', 'entradas') : 'sin entradas todavía')

  return [type, size].filter(Boolean).join(' · ')
}

/**
 * La tarjeta de una colección. Una sola para todas.
 *
 * Antes las de la comunidad tenían una versión chica, sin tapa. Pero lo que
 * separa a las de LetterRock de las de la comunidad ya lo dice el bloque en el
 * que caen: marcar esa diferencia también en la forma de la tarjeta hacía que
 * las de la comunidad se vieran de segunda.
 */
export function CollectionCard({ collection }) {
  const meta = collectionMeta(collection)

  return (
    <Link
      to={`/coleccion/${collection.slug}`}
      className="group card card-hover !p-0 overflow-hidden flex flex-col"
    >
      <div className="aspect-[16/9] bg-rock-border overflow-hidden relative flex items-end p-6">
        {collection.cover_url && (
          <>
            <img
              src={collection.cover_url}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover washed
                         transition-[filter,transform] duration-500
                         group-hover:filter-none group-hover:scale-[1.04]"
            />
            {/* Un velo de abajo hacia arriba detrás del título. La sombra de
                texto sola no alcanzaba: sobre una tapa clara o con mucho
                detalle, el blanco se perdía igual. El velo oscurece sólo la
                franja donde va el texto y deja la parte de arriba intacta. */}
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent"
            />
          </>
        )}
        {/* El título va sobre la tapa: sin él, una tapa sin texto no dice cuál
            colección es hasta leer el cuerpo. */}
        <span className="relative font-display text-[27px] leading-tight max-w-[20ch] text-white
                         [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          {collection.title}
        </span>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        {collection.author && (
          <p className="text-xs text-gray-500 mb-1.5">por {collection.author.username}</p>
        )}
        {collection.description && (
          <p className="text-[14.5px] text-gray-400 leading-relaxed line-clamp-3 mb-3.5">
            {collection.description}
          </p>
        )}
        <div className="flex gap-2 flex-wrap mt-auto">
          {meta && <span className="tag tag-accent">{meta}</span>}
          <StatusTags collection={collection} />
        </div>
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
  const { data: collections = [], isLoading, error, refetch } = useCollections()
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
    <div className="animate-fade-up">
      <header className="max-w-[56ch] py-10">
        <p className="kicker mb-3.5">Para escuchar en orden</p>
        <h1 className="text-screen mb-4">Colecciones</h1>
        <p className="text-[16.5px] leading-relaxed text-gray-300 mb-6">
          Timelines por época, listas y rankings. Elegí una y escuchala de
          principio a fin, o armá la tuya.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          {user ? (
            <NewCollectionButton />
          ) : (
            <Link to="/auth/login" className="btn btn-primary px-6 py-3">
              Entrá para armar la tuya
            </Link>
          )}
          {isEditor && (
            <Link to="/admin/colecciones" className="btn btn-secondary px-6 py-3">
              Administrar
            </Link>
          )}
        </div>
      </header>

      {isLoading ? (
        <SkeletonGrid count={4} min={300} />
      ) : error ? (
        <ErrorState title="No pudimos traer las colecciones." onRetry={refetch} />
      ) : (
        <>
          {official.length > 0 && (
            <section className="mb-16">
              <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 mb-4">
                DE LETTERROCK
              </p>
              <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
                {official.map(c => <CollectionCard key={c.id} collection={c} />)}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-baseline gap-4 flex-wrap mb-4">
              <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500">
                DE LA COMUNIDAD
              </p>
              {/* El selector es sólo de este bloque: las de la app van fijadas
                  arriba en el orden que eligió el editor. */}
              {community.length > 1 && (
                <div className="seg ml-auto">
                  {Object.entries(SORTS).map(([value, { label }]) => (
                    <label key={value} className="seg-opt">
                      <input
                        type="radio"
                        name="sort"
                        checked={sort === value}
                        onChange={() => changeSort(value)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {community.length === 0 ? (
              <EmptyState
                title="Todavía nadie armó la suya"
                action={
                  !user && (
                    <Link to="/auth/login" className="btn btn-secondary">Entrar</Link>
                  )
                }
              >
                {user
                  ? 'Podés ser el primero: elegí discos y ordenalos como quieras.'
                  : 'Con una cuenta podés armar tus propios recorridos.'}
              </EmptyState>
            ) : (
              <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
                {community.map(c => <CollectionCard key={c.id} collection={c} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
