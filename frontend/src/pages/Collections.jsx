import { Link } from 'react-router-dom'
import { useCollections } from '../hooks/useCollections'
import { useRole } from '../hooks/useRole'

const TYPE_LABEL = {
  timeline: 'Timeline',
  list: 'Lista',
  ranking: 'Ranking',
}

function CollectionCard({ collection }) {
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
        </div>

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

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-rock-text">Colecciones</h1>
          {isEditor && (
            <Link to="/admin/colecciones" className="text-sm text-gray-500 hover:text-rock-accent">
              Editar
            </Link>
          )}
        </div>
        <p className="text-gray-500 text-sm mt-2">
          Recorridos armados a mano: la historia disco por disco, listas y rankings.
        </p>
      </header>

      {isLoading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : collections.length === 0 ? (
        <p className="text-gray-500 text-sm">Todavía no hay colecciones publicadas.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map(c => <CollectionCard key={c.id} collection={c} />)}
        </div>
      )}
    </div>
  )
}
