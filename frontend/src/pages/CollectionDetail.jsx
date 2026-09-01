import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import FavoriteButton from '../components/common/FavoriteButton'
import RatingStars from '../components/common/RatingStars'
import ReviewCard from '../components/common/ReviewCard'
import TimelineEntry from '../components/common/TimelineEntry'
import ReviewForm from '../components/forms/ReviewForm'
import { useReviews } from '../hooks/useReviews'
import { useBandMembersMany } from '../hooks/useArtistMembers'
import { useCollection } from '../hooks/useCollections'
import { useRole } from '../hooks/useRole'
import { useAuthStore } from '../store/authStore'
import { useAlbumMedia } from '../hooks/useTopTracks'

/**
 * Las entradas de una lista o un ranking, de corrido.
 *
 * Reusa la misma tarjeta que la timeline: el disco se lee igual, con su texto,
 * su reproductor y su formación. Lo único que cambia es qué manda el orden, y en
 * un ranking, el número gigante al costado.
 */
function FlatEntries({ entries, isRanking }) {
  // El álbum de una canción cuenta igual: de ahí salen su reproductor y su
  // formación, que la canción no tiene por sí sola.
  const albumIds = useMemo(
    () => entries.map(e => e.album?.id || e.track?.album?.id).filter(Boolean),
    [entries]
  )
  const { data: albumMedia = {} } = useAlbumMedia(albumIds)

  const artistIds = useMemo(
    () => entries.map(e => e.album?.artist?.id || e.track?.album?.artist?.id).filter(Boolean),
    [entries]
  )
  const { data: membersByArtist = {} } = useBandMembersMany(artistIds)

  return (
    <div>
      {entries.map((entry, i) => (
        <div key={entry.id} className="flex gap-4 md:gap-6">
          {isRanking && (
            <div className="pt-10 flex-shrink-0 w-12 md:w-20 text-right">
              <span className="text-3xl md:text-5xl font-black text-rock-accent tabular-nums">
                {entry.rank ?? i + 1}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <TimelineEntry
              entry={entry}
              media={albumMedia[entry.album?.id || entry.track?.album?.id] || null}
              people={membersByArtist[entry.album?.artist?.id || entry.track?.album?.artist?.id] || null}
              standalone
            />
          </div>
        </div>
      ))}
    </div>
  )
}

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
  const user = useAuthStore(s => s.user)
  const { data, isLoading } = useCollection(slug)

  // Van antes del early return: los hooks no pueden quedar detrás de un `if`.
  const collectionId = data?.collection?.id
  const { reviews, createReview, deleteReview } = useReviews('collection', collectionId)

  if (isLoading) return <p className="text-gray-500">Cargando...</p>
  if (!data) return <p className="text-red-400">Colección no encontrada.</p>

  const { collection, sections, entries } = data
  const isTimeline = collection.type === 'timeline'
  const isRanking = collection.type === 'ranking'
  const canEdit = isEditor || (!!user && collection.created_by === user.id)

  // Se muestra pero no ordena el índice: con tres votos el promedio lo gana el
  // que se autovota primero.
  const average = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null

  return (
    <div className="space-y-10">
      <Link
        to="/colecciones"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-rock-accent text-sm transition-colors"
      >
        ← Colecciones
      </Link>

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
          <FavoriteButton entityType="collection" entityId={collection.id} />
          {canEdit && (
            <Link
              to={`/coleccion/${collection.slug}/editar`}
              className="text-sm text-gray-500 hover:text-rock-accent"
            >
              Editar
            </Link>
          )}
        </div>

        {collection.author && (
          <p className="text-gray-500 text-sm mt-2">
            por{' '}
            <Link to={`/user/${collection.author.username}`} className="hover:text-rock-accent">
              {collection.author.username}
            </Link>
          </p>
        )}

        {!isTimeline && average !== null && (
          <div className="flex items-center gap-2 mt-3">
            <RatingStars value={Math.round(average)} />
            <span className="text-gray-500 text-sm">
              {average.toFixed(1)} · {reviews.length} {reviews.length === 1 ? 'opinión' : 'opiniones'}
            </span>
          </div>
        )}
        {collection.description && (
          <p className="text-gray-400 mt-3 leading-relaxed">{collection.description}</p>
        )}
      </header>

      {!isTimeline ? (
        entries.length === 0 ? (
          <p className="text-gray-500 text-sm">Esta colección todavía no tiene discos.</p>
        ) : (
          <FlatEntries entries={entries} isRanking={isRanking} />
        )
      ) : sections.length === 0 ? (
        <p className="text-gray-500 text-sm">Esta colección todavía no tiene secciones.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map(s => (
            <SectionCard key={s.id} collectionSlug={collection.slug} section={s} />
          ))}
        </div>
      )}

      {/* Opinar sobre una lista curada es tan válido como opinar sobre un disco:
          lo que se juzga es la selección, no la música.

          En una timeline no va acá: esta página es un índice de épocas, y lo que
          se lee —y por lo tanto lo que se opina— está adentro de cada una. */}
      {!isTimeline && (
      <section className="max-w-2xl">
        <h2 className="text-xl font-bold text-rock-text mb-4">
          Opiniones ({reviews.length})
        </h2>
        <div className="space-y-4">
          <ReviewForm entityType="collection" entityId={collection.id} onSubmit={createReview} />
          {reviews.length > 0 ? (
            reviews.map(r => (
              <ReviewCard key={r.id} review={r} onDelete={() => deleteReview(r.id)} />
            ))
          ) : (
            <p className="text-gray-500 text-sm">Todavía nadie opinó.</p>
          )}
        </div>
      </section>
      )}
    </div>
  )
}
