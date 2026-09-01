import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import FavoriteButton from '../components/common/FavoriteButton'
import RatingStars from '../components/common/RatingStars'
import ReviewCard from '../components/common/ReviewCard'
import TimelineEntry from '../components/common/TimelineEntry'
import ReviewForm from '../components/forms/ReviewForm'
import { useReviews } from '../hooks/useReviews'
import YearRail from '../components/common/YearRail'
import { groupEntriesByYear, useCollectionSection } from '../hooks/useCollections'
import { useRole } from '../hooks/useRole'
import { useAuthStore } from '../store/authStore'
import { useBandMembersMany } from '../hooks/useArtistMembers'
import { useAlbumMedia } from '../hooks/useTopTracks'

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
  const { isEditor } = useRole()
  const user = useAuthStore(s => s.user)
  const { data, isLoading } = useCollectionSection(slug, sectionSlug)

  // Antes de cualquier return: los hooks no pueden quedar detrás de un `if`.
  const sectionId = data?.section?.id
  const { reviews, createReview, deleteReview } = useReviews('collection_section', sectionId)

  const groups = useMemo(
    () => groupEntriesByYear(data?.entries || []),
    [data?.entries]
  )

  const albumIds = useMemo(
    () => (data?.entries || []).map(e => e.album?.id || e.track?.album?.id).filter(Boolean),
    [data?.entries]
  )
  const { data: albumMedia = {} } = useAlbumMedia(albumIds)

  // La formación de todas las bandas de la página en una sola consulta. Pedirla
  // por disco eran veinte idas y vueltas al abrir una década.
  const artistIds = useMemo(
    () => (data?.entries || [])
      .map(e => e.album?.artist?.id || e.track?.album?.artist?.id)
      .filter(Boolean),
    [data?.entries]
  )
  const { data: membersByArtist = {} } = useBandMembersMany(artistIds)

  const [activeLabel, setActiveLabel] = useState(null)
  const yearRefs = useRef({})

  // Marca en el índice lateral el año que el lector está mirando.
  useEffect(() => {
    const nodes = Object.values(yearRefs.current).filter(Boolean)
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed
          .filter(o => o.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveLabel(visible[0].target.dataset.year)
      },
      { rootMargin: '-15% 0px -70% 0px' }
    )

    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [groups])

  const goToYear = (label) => {
    yearRefs.current[label]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (isLoading) return <p className="text-gray-500">Cargando...</p>
  if (!data?.collection) return <p className="text-red-400">Colección no encontrada.</p>
  if (!data.section) return <p className="text-red-400">Sección no encontrada.</p>

  const { collection, section, entries, prev, next } = data
  const canEdit = isEditor || (!!user && collection.created_by === user.id)

  const average = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null

  return (
    <div className="space-y-8">
      <Link
        to={`/coleccion/${collection.slug}`}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-rock-accent text-sm transition-colors"
      >
        ← {collection.title}
      </Link>

      {/* La misma portada que identifica a la época en la tarjeta de la
          colección. Sin esto sólo se veía en la grilla de la que venís. */}
      {section.cover_url && (
        <div className="relative -mx-4 sm:mx-0 sm:rounded-lg overflow-hidden aspect-[16/6] bg-rock-dark">
          <img
            src={section.cover_url}
            alt={section.title}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-rock-dark to-transparent" />
        </div>
      )}

      <header className="max-w-2xl">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-5xl font-black text-rock-text">{section.title}</h1>
          {canEdit && (
            <Link
              to={`/coleccion/${collection.slug}/${section.slug}/editar`}
              className="text-sm text-gray-500 hover:text-rock-accent"
            >
              Editar
            </Link>
          )}
        </div>
        {section.subtitle && (
          <p className="text-rock-accent mt-2 tracking-wide">{section.subtitle}</p>
        )}
        <div className="flex items-center gap-3 mt-3">
          <FavoriteButton entityType="collection_section" entityId={section.id} />
          {average !== null && (
            <>
              <RatingStars value={Math.round(average)} />
              <span className="text-gray-500 text-sm">
                {average.toFixed(1)} · {reviews.length} {reviews.length === 1 ? 'opinión' : 'opiniones'}
              </span>
            </>
          )}
        </div>
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
        <div className="flex gap-10">
          <YearRail groups={groups} activeLabel={activeLabel} onSelect={goToYear} />

          <div className="flex-1 min-w-0 max-w-4xl">
            {groups.map(group => (
              <section
                key={group.label}
                ref={el => { yearRefs.current[group.label] = el }}
                data-year={group.label}
                className="scroll-mt-24"
              >
                <div className="sticky top-16 z-10 bg-rock-dark/95 backdrop-blur py-3 -mx-2 px-2 border-b border-rock-border">
                  <h2 className="text-4xl font-black text-rock-accent">{group.label}</h2>
                </div>

                {group.entries.map(e => (
                  <TimelineEntry
                    key={e.id}
                    entry={e}
                    media={albumMedia[e.album?.id || e.track?.album?.id] || null}
                    people={membersByArtist[e.album?.artist?.id || e.track?.album?.artist?.id] || null}
                  />
                ))}
              </section>
            ))}
          </div>
        </div>
      )}

      {/* La opinión va en la época y no en la colección: en una timeline lo que
          se lee de corrido es esto, y la portada es apenas un índice de épocas. */}
      <section className="max-w-2xl">
        <h2 className="text-xl font-bold text-rock-text mb-4">
          Opiniones sobre {section.title} ({reviews.length})
        </h2>
        <div className="space-y-4">
          <ReviewForm entityType="collection_section" entityId={section.id} onSubmit={createReview} />
          {reviews.length > 0 ? (
            reviews.map(r => (
              <ReviewCard key={r.id} review={r} onDelete={() => deleteReview(r.id)} />
            ))
          ) : (
            <p className="text-gray-500 text-sm">Todavía nadie opinó de esta época.</p>
          )}
        </div>
      </section>

      <SectionNav collectionSlug={collection.slug} prev={prev} next={next} />
    </div>
  )
}
