import { Link, useParams } from 'react-router-dom'
import { useCollection } from '../hooks/useCollections'
import { useRole } from '../hooks/useRole'

function SectionCard({ collectionSlug, section }) {
  return (
    <Link
      to={`/coleccion/${collectionSlug}/${section.slug}`}
      className="group relative overflow-hidden rounded-lg bg-rock-card border border-rock-border hover:border-rock-accent transition-colors"
    >
      <div className="aspect-[3/2] bg-rock-dark overflow-hidden">
        {section.cover_url ? (
          <img
            src={section.cover_url}
            alt={section.title}
            loading="lazy"
            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl font-black text-rock-border group-hover:text-rock-accent transition-colors">
              {section.title}
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-xl font-bold text-rock-text group-hover:text-rock-accent transition-colors">
          {section.title}
        </h3>
        {section.subtitle && (
          <p className="text-gray-400 text-sm mt-1">{section.subtitle}</p>
        )}
        <p className="text-gray-600 text-xs mt-2">
          {section.entry_count === 0
            ? 'Sin discos todavía'
            : `${section.entry_count} ${section.entry_count === 1 ? 'disco' : 'discos'}`}
        </p>
      </div>
    </Link>
  )
}

export default function CollectionDetail() {
  const { slug } = useParams()
  const { isEditor } = useRole()
  const { data, isLoading } = useCollection(slug)

  if (isLoading) return <p className="text-gray-500">Cargando...</p>
  if (!data) return <p className="text-red-400">Colección no encontrada.</p>

  const { collection, sections } = data

  return (
    <div className="space-y-10">
      {/* La portada de la colección abre la página. Es el único lugar donde se
          ve: la de las secciones vive en su tarjeta, más abajo. */}
      {collection.cover_url && (
        <div className="relative -mx-4 sm:mx-0 sm:rounded-lg overflow-hidden aspect-[16/6] bg-rock-dark">
          <img
            src={collection.cover_url}
            alt={collection.title}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-rock-dark to-transparent" />
        </div>
      )}

      <header className="max-w-2xl">
        {!collection.is_published && (
          <span className="text-xs uppercase tracking-widest text-rock-accent border border-rock-accent rounded px-2 py-0.5">
            Borrador
          </span>
        )}
        <div className="flex items-baseline gap-3 flex-wrap mt-3">
          <h1 className="text-4xl font-bold text-rock-text">{collection.title}</h1>
          {isEditor && (
            <Link
              to={`/admin/coleccion/${collection.slug}`}
              className="text-sm text-gray-500 hover:text-rock-accent"
            >
              Editar
            </Link>
          )}
        </div>
        {collection.description && (
          <p className="text-gray-400 mt-3 leading-relaxed">{collection.description}</p>
        )}
      </header>

      {sections.length === 0 ? (
        <p className="text-gray-500 text-sm">Esta colección todavía no tiene secciones.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map(s => (
            <SectionCard key={s.id} collectionSlug={collection.slug} section={s} />
          ))}
        </div>
      )}
    </div>
  )
}
