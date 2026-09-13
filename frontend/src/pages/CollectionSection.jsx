import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import FavoriteButton from '../components/common/FavoriteButton'
import RatingStars from '../components/common/RatingStars'
import PlaylistPanel from '../components/common/PlaylistPanel'
import ReviewCard from '../components/common/ReviewCard'
import TimelineEntry from '../components/common/TimelineEntry'
import ReviewForm from '../components/forms/ReviewForm'
import { useReviews } from '../hooks/useReviews'
import { EmptyState, NotFoundLine, SkeletonRows } from '../components/common/States'
import { IconArrowLeft } from '../components/common/Icons'
import YearRail from '../components/common/YearRail'
import { groupEntriesByYear, useCollectionSection } from '../hooks/useCollections'
import { useRole } from '../hooks/useRole'
import { useAuthStore } from '../store/authStore'
import { useBandMembersMany } from '../hooks/useArtistMembers'
import { useAlbumMedia } from '../hooks/useTopTracks'

/*
 * Pasar a la época de al lado.
 *
 * Dos tarjetas y no dos links sueltos: al terminar de leer una época lo que
 * sigue es la otra, y merece el mismo peso que el resto de la página. Cuando
 * falta una de las dos, la que queda no se estira: conserva su lado.
 */
function SectionNav({ collectionSlug, prev, next }) {
  if (!prev && !next) return null

  const card = 'card card-hover flex-1 min-w-[240px] !py-5 !px-6 group'

  return (
    <nav aria-label="Otras épocas" className="flex flex-wrap gap-4 mt-14">
      {prev ? (
        <Link to={`/coleccion/${collectionSlug}/${prev.slug}`} className={card}>
          <p className="font-mono text-[10px] tracking-[0.16em] text-gray-500 mb-2">← ÉPOCA ANTERIOR</p>
          <p className="font-display text-[26px] leading-none group-hover:text-rock-accent transition-colors">
            {prev.title}
          </p>
        </Link>
      ) : <span className="flex-1 min-w-[240px] hidden sm:block" />}

      {next ? (
        <Link to={`/coleccion/${collectionSlug}/${next.slug}`} className={`${card} text-right`}>
          <p className="font-mono text-[10px] tracking-[0.16em] text-gray-500 mb-2">ÉPOCA SIGUIENTE →</p>
          <p className="font-display text-[26px] leading-none group-hover:text-rock-accent transition-colors">
            {next.title}
          </p>
        </Link>
      ) : <span className="flex-1 min-w-[240px] hidden sm:block" />}
    </nav>
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

  if (isLoading) return <div className="py-11"><SkeletonRows count={4} avatar={false} /></div>
  if (!data?.collection) return <NotFoundLine>Colección no encontrada.</NotFoundLine>
  if (!data.section) return <NotFoundLine>Época no encontrada.</NotFoundLine>

  const { collection, section, entries, prev, next } = data
  const canEdit = isEditor || (!!user && collection.created_by === user.id)

  const average = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null

  return (
    <div className="animate-fade-up">
      <Link
        to={`/coleccion/${collection.slug}`}
        className="inline-flex items-center gap-2 text-[13.5px] text-gray-400 hover:text-rock-accent pt-4"
      >
        <IconArrowLeft size={14} /> {collection.title}
      </Link>

      {/* La misma portada que identifica a la época en la tarjeta de la
          colección. Sin esto sólo se veía en la grilla de la que venís. */}
      {section.cover_url && (
        <div className="relative mt-5 rounded-3xl overflow-hidden aspect-[16/6] bg-rock-card shadow-card">
          <img
            src={section.cover_url}
            alt=""
            className="w-full h-full object-cover washed opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-rock-dark to-transparent" />
        </div>
      )}

      <header className="max-w-2xl py-8">
        {section.subtitle && <p className="kicker mb-3">{section.subtitle}</p>}
        <div className="flex items-baseline gap-3 flex-wrap mb-4">
          <h1 className="text-screen">{section.title}</h1>
          {canEdit && (
            <Link
              to={`/coleccion/${collection.slug}/${section.slug}/editar`}
              className="btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px]"
            >
              Editar
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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
              <p key={i} className="text-[17px] leading-[1.7] text-gray-300 max-w-[62ch]">{p}</p>
            ))}
          </div>
        )}
      </header>

      {/*
        Todo lo que viene después del encabezado vive en la misma columna: las
        entradas, la playlist, las opiniones y el paso a la otra época. Así
        comparten borde izquierdo y ancho — antes la playlist y las opiniones
        quedaban afuera del riel de años y arrancaban en otra línea.
      */}
      <div className="flex gap-10">
        {entries.length > 0 && (
          <YearRail groups={groups} activeLabel={activeLabel} onSelect={goToYear} />
        )}

        <div className="flex-1 min-w-0">
          {entries.length === 0 ? (
            <EmptyState
              title="Todavía sin entradas"
              action={canEdit && (
                <Link
                  to={`/coleccion/${collection.slug}/${section.slug}/editar`}
                  className="btn btn-secondary"
                >
                  Agregar discos
                </Link>
              )}
            >
              Esta época está creada pero vacía.
            </EmptyState>
          ) : (
            groups.map(group => (
              <section
                key={group.label}
                ref={el => { yearRefs.current[group.label] = el }}
                data-year={group.label}
                className="scroll-mt-24"
              >
                <div className="sticky top-[61px] z-10 bg-rock-dark/95 backdrop-blur-md py-3
                                flex items-center gap-5">
                  <h2
                    className="font-display text-rock-accent leading-none"
                    style={{ fontSize: 'clamp(38px, 4.6vw, 54px)', letterSpacing: '-0.03em' }}
                  >
                    {group.label}
                  </h2>
                  <span className="flex-1 h-px bg-rock-border" />
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
            ))
          )}

          {/* La playlist de la época, no la de la colección: "Los 70" no suena
              como toda la historia del rock argentino. */}
          <PlaylistPanel
            playlistUrl={section.playlist_url}
            entries={entries}
            media={albumMedia}
            title={`${collection.title} · ${section.title}`}
          />

          {/* La opinión va en la época y no en la colección: en una timeline lo
              que se lee de corrido es esto, y la portada es apenas un índice de
              épocas. */}
          <section className="w-full mt-14">
            <h2 className="font-display text-[34px] leading-none mb-5">
              Opiniones sobre {section.title}
              {reviews.length > 0 && <span className="text-gray-500"> ({reviews.length})</span>}
            </h2>
            <div className="space-y-4">
              <ReviewForm entityType="collection_section" entityId={section.id} onSubmit={createReview} />
              {reviews.length > 0 ? (
                reviews.map(r => (
                  <ReviewCard key={r.id} review={r} onDelete={() => deleteReview(r.id)} />
                ))
              ) : (
                <EmptyState title="Todavía nadie opinó">
                  Decí qué te dejó esta época.
                </EmptyState>
              )}
            </div>
          </section>

          <SectionNav collectionSlug={collection.slug} prev={prev} next={next} />
        </div>
      </div>
    </div>
  )
}
