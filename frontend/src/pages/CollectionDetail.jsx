import { Fragment, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import ArrowLink from '../components/common/ArrowLink'
import FavoriteButton from '../components/common/FavoriteButton'
import RatingStars from '../components/common/RatingStars'
import PlaylistPanel from '../components/common/PlaylistPanel'
import ReviewCard from '../components/common/ReviewCard'
import TimelineEntry from '../components/common/TimelineEntry'
import ReviewForm from '../components/forms/ReviewForm'
import { EmptyState, NotFoundLine, SkeletonRows } from '../components/common/States'
import { IconChevronRight } from '../components/common/Icons'
import { useReviews } from '../hooks/useReviews'
import { useBandMembersMany } from '../hooks/useArtistMembers'
import { useCollection } from '../hooks/useCollections'
import { useRole } from '../hooks/useRole'
import { useAuthStore } from '../store/authStore'
import { useAlbumMedia } from '../hooks/useTopTracks'

const TYPE_KICKER = { timeline: 'Timeline', list: 'Lista', ranking: 'Ranking' }

/**
 * Las entradas de una lista o un ranking, de corrido.
 *
 * Reusa la misma tarjeta que la timeline: el disco se lee igual, con su texto,
 * su reproductor y su formación. Lo único que cambia es qué manda el orden.
 *
 * En un ranking la posición hace de lo que en la timeline hace el año: el
 * mismo encabezado naranja con la línea, fijo arriba mientras se lee el disco.
 * Antes el número iba en una columna al costado, que en el teléfono le robaba
 * ancho a la portada y quedaba colgado al lado de la cabecera.
 */
function FlatEntries({ entries, isRanking, albumMedia, membersByArtist }) {
  const card = (entry) => (
    <TimelineEntry
      entry={entry}
      media={albumMedia[entry.album?.id || entry.track?.album?.id] || null}
      people={membersByArtist[entry.album?.artist?.id || entry.track?.album?.artist?.id] || null}
      standalone
    />
  )

  if (!isRanking) {
    // Sin envoltorio por entrada: la línea entre discos es el `border-b` de
    // cada tarjeta, que se apaga en la última (`last:`). Envuelta cada una en
    // su div, todas eran "la última" y la lista quedaba sin separadores.
    return <div>{entries.map(entry => <Fragment key={entry.id}>{card(entry)}</Fragment>)}</div>
  }

  return (
    <div>
      {entries.map((entry, i) => (
        <section key={entry.id} aria-label={`Puesto ${entry.rank ?? i + 1}`}>
          <div className="sticky top-[61px] z-10 bg-rock-dark/95 backdrop-blur-md py-3
                          flex items-center gap-5">
            <h2
              className="font-display text-rock-accent leading-none tabular-nums"
              style={{ fontSize: 'clamp(38px, 4.6vw, 54px)', letterSpacing: '-0.03em' }}
            >
              {entry.rank ?? i + 1}
            </h2>
            <span className="flex-1 h-px bg-rock-border" />
          </div>
          {card(entry)}
        </section>
      ))}
    </div>
  )
}

/**
 * "12 discos", "10 temas" o, si están mezclados, "12 entradas".
 *
 * "Entradas" es la palabra del modelo de datos; quien lee una lista de discos
 * cuenta discos.
 */
function countLabel(entries) {
  const n = entries.length
  const types = new Set(entries.map(e => e.entry_type))
  const only = types.size === 1 ? [...types][0] : null
  const [one, many] = {
    album: ['disco', 'discos'],
    track: ['tema', 'temas'],
    artist: ['artista', 'artistas'],
  }[only] || ['entrada', 'entradas']
  return `${n} ${n === 1 ? one : many}`
}

/*
 * Una época, en una fila ancha y no en una tarjeta de grilla.
 *
 * Son pocas y con nombre propio ("Los 70"), así que la fila les deja lugar al
 * subtítulo, que es lo que explica de qué va la época. En una grilla de tres
 * columnas ese subtítulo entraba cortado.
 */
function SectionRow({ collectionSlug, section, n }) {
  return (
    <Link
      to={`/coleccion/${collectionSlug}/${section.slug}`}
      className="card card-hover !p-4 flex flex-wrap gap-6 items-center group"
    >
      <div className="w-full sm:w-[190px] h-[126px] flex-none rounded-xl overflow-hidden bg-rock-border grid place-items-center">
        {section.cover_url ? (
          <img
            src={section.cover_url}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover washed transition-[filter] duration-500 group-hover:filter-none"
          />
        ) : (
          <span className="font-display text-3xl text-gray-500">{section.title}</span>
        )}
      </div>

      <div className="flex-1 min-w-[240px]">
        <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 mb-2">ÉPOCA {n}</p>
        <p className="font-display text-3xl leading-none mb-2 group-hover:text-rock-accent transition-colors">
          {section.title}
        </p>
        {section.subtitle && (
          <p className="text-[15px] text-gray-400 leading-snug max-w-[46ch]">{section.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4 flex-none pr-2">
        <span className="text-[12.5px] text-gray-500 whitespace-nowrap">
          {section.entry_count === 0
            ? 'sin discos'
            : `${section.entry_count} ${section.entry_count === 1 ? 'disco' : 'discos'}`}
        </span>
        <IconChevronRight size={20} className="text-rock-accent" />
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

  // El álbum de una canción cuenta igual: de ahí salen su reproductor y su
  // formación, que la canción no tiene por sí sola.
  //
  // Se piden acá y no dentro de las tarjetas porque la playlist derivada
  // necesita los mismos datos: los ids de YouTube de cada tema salen de acá.
  const entries = data?.entries || []
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

  if (isLoading) return <div className="py-11"><SkeletonRows count={3} avatar={false} /></div>
  if (!data) return <NotFoundLine>Colección no encontrada.</NotFoundLine>

  const { collection, sections } = data
  const isTimeline = collection.type === 'timeline'
  const isRanking = collection.type === 'ranking'
  const canEdit = isEditor || (!!user && collection.created_by === user.id)

  // Se muestra pero no ordena el índice: con tres votos el promedio lo gana el
  // que se autovota primero.
  const average = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null

  const kicker = [
    TYPE_KICKER[collection.type] || null,
    collection.is_official ? 'de LetterRock' : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="animate-fade-up">
      <ArrowLink back to="/colecciones" className="mt-4">Colecciones</ArrowLink>

      {/* La portada abre la página con el título encima. Es el único lugar
          donde se ve: la de las épocas vive en su fila, más abajo. */}
      <div className="relative mt-5 rounded-3xl overflow-hidden bg-rock-card shadow-card
                      min-h-[220px] flex items-end p-7 md:p-10">
        {collection.cover_url && (
          <>
            <img
              src={collection.cover_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover washed opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-rock-dark via-rock-dark/50 to-transparent" />
          </>
        )}
        <div className="relative max-w-[26ch]">
          <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-400 mb-3 uppercase">
            {kicker}
          </p>
          <h1 className="text-screen">{collection.title}</h1>
        </div>
      </div>

      <div className="flex flex-wrap gap-9 items-start py-8">
        <div className="flex-1 min-w-[320px]">
          {collection.description && (
            <p className="text-[17px] leading-[1.66] text-gray-300 max-w-prose mb-4">
              {collection.description}
            </p>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            <FavoriteButton entityType="collection" entityId={collection.id} />
            {canEdit && (
              <Link
                to={`/coleccion/${collection.slug}/editar`}
                className="btn btn-secondary !min-h-0 !px-4 !py-2 !text-[13px]"
              >
                Editar
              </Link>
            )}
            {/* Las de LetterRock se presentan como de la app, no de quien las cargó. */}
            {collection.author && !collection.is_official && (
              <span className="text-sm text-gray-500">
                por{' '}
                <Link to={`/user/${collection.author.username}`} className="hover:text-rock-accent">
                  {collection.author.username}
                </Link>
              </span>
            )}
          </div>

          {!isTimeline && average !== null && (
            <div className="flex items-center gap-2 mt-3">
              <RatingStars value={Math.round(average)} />
              <span className="text-gray-500 text-sm">
                {average.toFixed(1)} · {reviews.length} {reviews.length === 1 ? 'opinión' : 'opiniones'}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap flex-none">
          {!collection.is_published && <span className="tag tag-outline">Borrador</span>}
          {isTimeline && sections.length > 0 && (
            <span className="tag tag-accent">
              {sections.length} {sections.length === 1 ? 'época' : 'épocas'}
            </span>
          )}
          {entries.length > 0 && (
            <span className="tag tag-neutral">{countLabel(entries)}</span>
          )}
        </div>
      </div>

      {!isTimeline ? (
        entries.length === 0 ? (
          <EmptyState
            title="Todavía sin discos"
            action={canEdit && (
              <Link to={`/coleccion/${collection.slug}/editar`} className="btn btn-secondary">
                Agregar discos
              </Link>
            )}
          >
            Esta colección está armada pero vacía.
          </EmptyState>
        ) : (
          <FlatEntries
            entries={entries}
            isRanking={isRanking}
            albumMedia={albumMedia}
            membersByArtist={membersByArtist}
          />
        )
      ) : sections.length === 0 ? (
        <EmptyState
          title="Todavía sin épocas"
          action={canEdit && (
            <Link to={`/coleccion/${collection.slug}/editar`} className="btn btn-secondary">
              Armar la primera
            </Link>
          )}
        >
          Una timeline se divide en épocas; ésta no tiene ninguna todavía.
        </EmptyState>
      ) : (
        <>
          <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 mb-5">LAS ÉPOCAS</p>
          <div className="flex flex-col gap-4 pb-12">
            {sections.map((s, i) => (
              <SectionRow key={s.id} collectionSlug={collection.slug} section={s} n={i + 1} />
            ))}
          </div>
        </>
      )}

      {/* En una timeline las entradas viven en las épocas, así que acá sólo
          puede aparecer la playlist que alguien haya pegado. Es correcto: la
          derivada de "los 70" se arma en la página de los 70. */}
      <PlaylistPanel
        playlistUrl={collection.playlist_url}
        entries={entries}
        media={albumMedia}
      />

      {/* Opinar sobre una lista curada es tan válido como opinar sobre un disco:
          lo que se juzga es la selección, no la música.

          En una timeline no va acá: esta página es un índice de épocas, y lo que
          se lee —y por lo tanto lo que se opina— está adentro de cada una. */}
      {!isTimeline && (
        <section className="max-w-2xl mt-12">
          <h2 className="font-display text-3xl mb-5">
            Opiniones sobre <span className="text-rock-accent">{collection.title}</span>
          </h2>
          <div className="space-y-4">
            <ReviewForm entityType="collection" entityId={collection.id} onSubmit={createReview} />
            {reviews.length > 0 ? (
              reviews.map(r => (
                <ReviewCard key={r.id} review={r} onDelete={() => deleteReview(r.id)} />
              ))
            ) : (
              <EmptyState title="Todavía nadie opinó">
                Decí qué te parece esta selección.
              </EmptyState>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
