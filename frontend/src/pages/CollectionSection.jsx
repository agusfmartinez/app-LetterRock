import { Link, useParams } from 'react-router-dom'
import TimelineEntry from '../components/common/TimelineEntry'
import { useCollectionSection } from '../hooks/useCollections'

function SectionNav({ collectionSlug, prev, next }) {
  return (
    <div className="flex justify-between gap-4 pt-8 border-t border-rock-border">
      {prev ? (
        <Link
          to={`/coleccion/${collectionSlug}/${prev.slug}`}
          className="text-gray-400 hover:text-rock-accent text-sm"
        >
          ← {prev.title}
        </Link>
      ) : <span />}
      {next ? (
        <Link
          to={`/coleccion/${collectionSlug}/${next.slug}`}
          className="text-gray-400 hover:text-rock-accent text-sm text-right"
        >
          {next.title} →
        </Link>
      ) : <span />}
    </div>
  )
}

export default function CollectionSection() {
  const { slug, sectionSlug } = useParams()
  const { data, isLoading } = useCollectionSection(slug, sectionSlug)

  if (isLoading) return <p className="text-gray-500">Cargando...</p>
  if (!data?.collection) return <p className="text-red-400">Colección no encontrada.</p>
  if (!data.section) return <p className="text-red-400">Sección no encontrada.</p>

  const { collection, section, entries, prev, next } = data

  return (
    <div className="space-y-8">
      <Link
        to={`/coleccion/${collection.slug}`}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-rock-accent text-sm transition-colors"
      >
        ← {collection.title}
      </Link>

      <header className="max-w-2xl">
        <h1 className="text-5xl font-black text-rock-text">{section.title}</h1>
        {section.subtitle && (
          <p className="text-rock-accent mt-2 tracking-wide">{section.subtitle}</p>
        )}
        {section.intro_text && (
          <div className="mt-5 space-y-3">
            {section.intro_text.split(/\n+/).filter(Boolean).map((p, i) => (
              <p key={i} className="text-gray-300 leading-relaxed">{p}</p>
            ))}
          </div>
        )}
      </header>

      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm">
          Todavía no hay discos cargados en esta época.
        </p>
      ) : (
        <div className="max-w-4xl">
          {entries.map(e => <TimelineEntry key={e.id} entry={e} />)}
        </div>
      )}

      <SectionNav collectionSlug={collection.slug} prev={prev} next={next} />
    </div>
  )
}
