import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ActivityItem from '../components/common/ActivityItem'
import ArrowLink from '../components/common/ArrowLink'
import ArtistCard from '../components/common/ArtistCard'
import PostForm from '../components/forms/PostForm'
import { EmptyState, ErrorState, SkeletonGrid, SkeletonRows } from '../components/common/States'
import { collectionMeta } from './Collections'
import { useActivityFeed } from '../hooks/useActivityFeed'
import { useCollections } from '../hooks/useCollections'
import { useMyFollowing } from '../hooks/useFollows'
import { usePopularArtists, usePopularIds } from '../hooks/usePopular'
import { useAuthStore } from '../store/authStore'

export default function Home() {
  const user = useAuthStore(s => s.user)
  const { data: following = [], isLoading: loadingFollowing } = useMyFollowing()

  // `null` = todavía no eligió nada y manda el default de abajo. En cuanto toca
  // una opción, esa gana y no se la volvemos a cambiar en el medio de la visita.
  const [choice, setChoice] = useState(null)

  // Las más guardadas en favoritos, completadas con las últimas en entrar si
  // todavía hay pocas con favoritos. Ver usePopular.
  const {
    data: popularArtists = [],
    isLoading: loading,
    error: artistsError,
    refetch: refetchArtists,
  } = usePopularArtists(12)

  /*
   * El feed es de a quienes seguís. Pero mostrarle eso a alguien que no sigue a
   * nadie es una pantalla vacía como primera impresión, y sin ver a nadie no
   * tiene a quién seguir: no se sale nunca.
   *
   * Entonces: si seguís a alguien, arranca en tu gente; si no, cae a toda la
   * comunidad, que ahí funciona como descubrimiento y no como muro global.
   */
  const onlyFollowing = choice ?? following.length > 0

  // El filtro sólo se aplica una vez que se sabe a quién sigue: pasar [] antes
  // de que llegue la respuesta vaciaría el feed por un instante.
  const scoped = onlyFollowing && !loadingFollowing
  const {
    data: activity = [],
    isLoading: loadingActivity,
    error: activityError,
    refetch: refetchActivity,
  } = useActivityFeed(20, scoped ? following : undefined)

  const { data: collections = [] } = useCollections()
  const { data: popularCollectionIds = [] } = usePopularIds('collection', 50)

  /*
   * Las colecciones del costado, de la más guardada a la menos. Sólo lo
   * publicado y visible: RLS le devuelve al dueño y al editor también sus
   * borradores, y la home no es el lugar para mostrarlos.
   *
   * A igual cantidad de favoritos — o sin ninguno, que hoy es lo común — van
   * primero las de LetterRock, que son las pensadas para arrancar.
   */
  const sideCollections = useMemo(() => {
    const favs = new Map(popularCollectionIds.map(p => [p.id, p.count]))
    return collections
      .filter(c => c.is_published && !c.hidden)
      .sort((a, b) =>
        (favs.get(b.id) || 0) - (favs.get(a.id) || 0) ||
        Number(b.is_official) - Number(a.is_official)
      )
      .slice(0, 4)
  }, [collections, popularCollectionIds])

  const noFollows = !!user && !loadingFollowing && following.length === 0

  return (
    <div className="animate-fade-up">
      {/* — Hero — */}
      <section className="flex flex-wrap items-center gap-12 py-10 md:py-16">
        <div className="flex-1 min-w-[320px]">
          <p className="kicker mb-4">Archivo abierto del rock argentino</p>
          <h1 className="text-hero mb-5">
            El rock argentino,
            <br />
            disco por disco.
          </h1>
          <p className="text-[17px] leading-relaxed text-gray-300 max-w-[44ch] mb-7">
            Fichas de bandas, discos y canciones escritas por quienes las escuchan.
            Puntuá, guardá lo tuyo y armá el recorrido que te falta.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link to="/search" className="btn btn-primary px-6 py-3 text-[15px]">
              Explorar el catálogo
            </Link>
            {/* Con sesión, "crear cuenta" no tiene sentido: lleva a lo suyo. */}
            {user ? (
              <Link to="/colecciones" className="btn btn-secondary px-6 py-3 text-[15px]">
                Ver colecciones
              </Link>
            ) : (
              <Link to="/auth/signup" className="btn btn-secondary px-6 py-3 text-[15px]">
                Crear mi cuenta
              </Link>
            )}
          </div>
        </div>

        {/* El disco girando. Decorativo: no lleva a ningún lado y no se anuncia
            a un lector de pantalla. */}
        <div
          aria-hidden="true"
          className="flex-1 min-w-[260px] relative grid place-items-center min-h-[280px]"
        >
          {/*
            Un disco negro sobre un fondo casi negro no se ve: surcos, sombra y
            halo tenían el mismo valor que la página. Lo que lo recorta es el
            círculo de atrás, que en la maqueta es un color sólido y claro —
            acá, terracota tintada, bastante más fuerte que un 5%.
          */}
          <span className="absolute w-[272px] h-[272px] max-w-[80vw] max-h-[80vw] rounded-full bg-rock-accent/20" />
          <span className="absolute left-[62%] top-[6%] w-24 h-24 rounded-full bg-rock-accent/35" />

          <span className="relative w-[244px] h-[244px] max-w-[68vw] max-h-[68vw]">
            <span
              className="absolute inset-0 rounded-full animate-spin-slow"
              style={{
                background: `
                  radial-gradient(circle at 50% 50%, #100d0b 0 3.2%, transparent 3.4%),
                  radial-gradient(circle at 50% 50%, #c1592c 3.4% 27%, transparent 27.5%),
                  repeating-radial-gradient(circle at 50% 50%, #2e251f 0 2px, #0f0c0a 2px 5px)
                `,
                // Filo claro en el borde + resplandor tibio: la sombra negra de
                // antes no existía sobre este fondo.
                boxShadow: '0 0 0 1px rgba(239,232,225,0.14), 0 22px 60px rgba(193,89,44,0.28)',
              }}
            />
            {/* El brillo del vinilo va en una capa aparte que NO gira: en un
                disco de verdad el reflejo queda quieto y los surcos pasan por
                debajo. Si girara con el disco se vería pintado encima. */}
            <span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: `conic-gradient(from 20deg,
                  transparent 0deg, rgba(255,240,225,0.13) 25deg, transparent 60deg,
                  transparent 180deg, rgba(255,240,225,0.08) 205deg, transparent 240deg)`,
                WebkitMask: 'radial-gradient(circle, transparent 27.5%, #000 28.5%)',
                mask: 'radial-gradient(circle, transparent 27.5%, #000 28.5%)',
              }}
            />
          </span>
        </div>
      </section>

      <div className="h-px bg-rock-border mb-11" />

      {/* — Bandas — */}
      <section className="mb-16">
        <div className="flex items-center gap-4 flex-wrap mb-6">
          <h2 className="font-display text-3xl">Artistas populares</h2>
          <ArrowLink to="/search">Ver todos</ArrowLink>
        </div>

        {loading ? (
          <SkeletonGrid count={6} min={140} />
        ) : artistsError ? (
          <ErrorState title="No pudimos traer los artistas." onRetry={refetchArtists} />
        ) : popularArtists.length === 0 ? (
          <EmptyState
            title="El archivo está vacío"
            action={<Link to="/search" className="btn btn-secondary">Buscar la primera</Link>}
          >
            Todavía no hay ninguna banda fichada. Buscala en el catálogo y quedará acá.
          </EmptyState>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>
            {/* Sin "Formado en…": acá la grilla es para reconocer caras, y el
                año es un dato de la ficha, no de la vidriera. */}
            {popularArtists.map(a => (
              <ArtistCard key={a.id} artist={a} variant="circle" showOrigin={false} />
            ))}
          </div>
        )}
      </section>

      {/* — Feed + costado — */}
      <div className="flex flex-wrap gap-11">
        <section className="flex-1 min-w-[320px]">
          <div className="flex items-baseline gap-4 flex-wrap mb-5">
            <h2 className="font-display text-3xl">Lo que se está escuchando</h2>
            {/* Sin sesión no hay a quién seguir, así que el filtro no aparece. */}
            {user && (
              <div className="seg ml-auto">
                {[
                  { value: false, label: 'Comunidad' },
                  { value: true, label: 'Siguiendo' },
                ].map(({ value, label }) => (
                  <label key={label} className="seg-opt">
                    <input
                      type="radio"
                      name="scope"
                      checked={onlyFollowing === value}
                      onChange={() => setChoice(value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Arriba del feed y no en una página aparte: postear es escribir en
              esto que estás mirando. `PostForm` no se muestra sin sesión. */}
          <PostForm />

          {loadingActivity ? (
            <SkeletonRows count={4} />
          ) : activityError ? (
            <ErrorState title="No pudimos traer la actividad." onRetry={refetchActivity} />
          ) : activity.length === 0 ? (
            /*
             * Tres vacíos distintos, con salidas distintas. "Siguiendo" sin
             * seguir a nadie no es silencio: es que falta elegir gente, y la
             * salida es ir a buscarla — por eso ese caso lleva el botón, y ya
             * no hay una caja aparte en el costado diciendo lo mismo.
             */
            scoped && noFollows ? (
              <EmptyState
                title="Todavía no seguís a nadie"
                action={<Link to="/usuarios" className="btn btn-secondary">Buscar gente</Link>}
              >
                Seguí gente para ver acá qué está escuchando.
              </EmptyState>
            ) : scoped ? (
              <EmptyState title="Silencio por acá">
                Nadie de los que seguís opinó todavía. Mirá qué pasa en la comunidad.
              </EmptyState>
            ) : (
              <EmptyState title="Todavía no pasó nada">
                Sé el primero: puntuá un disco o escribí qué estás escuchando.
              </EmptyState>
            )
          ) : (
            <div>
              {activity.map(a => (
                <ActivityItem key={`${a.kind}-${a.id}`} activity={a} />
              ))}
            </div>
          )}
        </section>

        {sideCollections.length > 0 && (
          <aside className="flex-1 min-w-[260px] max-w-[360px]">
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <h3 className="font-display text-xl">Colecciones populares</h3>
              <ArrowLink to="/colecciones" className="ml-auto">Ver todas</ArrowLink>
            </div>
            <div className="flex flex-col gap-3">
              {sideCollections.map(col => (
                <Link
                  key={col.id}
                  to={`/coleccion/${col.slug}`}
                  className="group flex gap-3.5 items-center bg-rock-card rounded-lg p-2.5 pr-4
                             hover:bg-rock-cardHover transition-colors"
                >
                  {/* Con tapa: a 46px la inicial no decía nada, y la tapa es lo
                      que hace reconocible a una colección. */}
                  <span className="w-[76px] h-[76px] flex-none rounded-md overflow-hidden bg-rock-border
                                   grid place-items-center">
                    {col.cover_url ? (
                      <img
                        src={col.cover_url}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover washed transition-[filter] group-hover:filter-none"
                      />
                    ) : (
                      <span className="font-display text-2xl text-gray-500">
                        {col.title?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    )}
                  </span>
                  {/* El título envuelve a dos líneas en vez de cortarse: los
                      nombres de colección son frases, y "Los 50 discos esen…"
                      no dice cuál es. */}
                  <div className="min-w-0">
                    <p className="font-display text-[15.5px] leading-[1.2] line-clamp-2 group-hover:text-rock-accent transition-colors">
                      {col.title}
                    </p>
                    <p className="text-[12px] text-gray-500 mt-1">{collectionMeta(col)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
