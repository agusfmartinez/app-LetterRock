import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ActivityItem from '../components/common/ActivityItem'
import ArtistCard from '../components/common/ArtistCard'
import PostForm from '../components/forms/PostForm'
import { EmptyState, ErrorState, SkeletonGrid, SkeletonRows } from '../components/common/States'
import { useActivityFeed } from '../hooks/useActivityFeed'
import { useCollections } from '../hooks/useCollections'
import { useMyFollowing } from '../hooks/useFollows'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'

export default function Home() {
  const user = useAuthStore(s => s.user)
  const { data: following = [], isLoading: loadingFollowing } = useMyFollowing()

  // `null` = todavía no eligió nada y manda el default de abajo. En cuanto toca
  // una opción, esa gana y no se la volvemos a cambiar en el medio de la visita.
  const [choice, setChoice] = useState(null)

  const {
    data: recentArtists = [],
    isLoading: loading,
    error: artistsError,
    refetch: refetchArtists,
  } = useQuery({
    queryKey: ['recent-artists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .eq('hidden', false)
        .order('created_at', { ascending: false })
        .limit(12)
      if (error) throw error
      return data || []
    },
  })

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
  const sideCollections = collections.slice(0, 3)
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
          <span className="absolute w-[272px] h-[272px] max-w-[80vw] max-h-[80vw] rounded-full bg-rock-accent/5" />
          <span className="absolute left-[62%] top-[6%] w-24 h-24 rounded-full bg-rock-accent/10" />
          <span
            className="relative w-[244px] h-[244px] max-w-[68vw] max-h-[68vw] rounded-full shadow-card-hover animate-spin-slow"
            style={{
              background: `
                radial-gradient(circle at 50% 50%, #100d0b 0 3.2%, transparent 3.4%),
                radial-gradient(circle at 50% 50%, #c1592c 3.4% 27%, transparent 27.5%),
                repeating-radial-gradient(circle at 50% 50%, #241d18 0 2.5px, #17120f 2.5px 5px)
              `,
            }}
          />
        </div>
      </section>

      <div className="h-px bg-rock-border mb-11" />

      {/* — Bandas — */}
      <section className="mb-16">
        <div className="flex items-baseline gap-4 flex-wrap mb-6">
          <h2 className="font-display text-3xl">Bandas que entraron al archivo</h2>
          <Link to="/search" className="text-[13px] text-rock-accent hover:text-rock-accentBright">
            ver todas →
          </Link>
        </div>

        {loading ? (
          <SkeletonGrid count={6} min={140} />
        ) : artistsError ? (
          <ErrorState title="No pudimos traer las bandas." onRetry={refetchArtists} />
        ) : recentArtists.length === 0 ? (
          <EmptyState
            title="El archivo está vacío"
            action={<Link to="/search" className="btn btn-secondary">Buscar la primera</Link>}
          >
            Todavía no hay ninguna banda fichada. Buscala en el catálogo y quedará acá.
          </EmptyState>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>
            {recentArtists.map(a => (
              <ArtistCard key={a.id} artist={a} variant="circle" />
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
                  { value: false, label: 'Toda la comunidad' },
                  { value: true, label: 'A quienes sigo' },
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
            <EmptyState title={scoped ? 'Silencio por acá' : 'Todavía no pasó nada'}>
              {scoped
                ? 'Nadie de los que seguís opinó todavía. Probá con toda la comunidad.'
                : 'Sé el primero: puntuá un disco o escribí qué estás escuchando.'}
            </EmptyState>
          ) : (
            <div>
              {activity.map(a => (
                <ActivityItem key={`${a.kind}-${a.id}`} activity={a} />
              ))}
            </div>
          )}
        </section>

        <aside className="flex-1 min-w-[250px] max-w-[330px]">
          {sideCollections.length > 0 && (
            <>
              <h3 className="font-display text-xl mb-3.5">Para empezar por algún lado</h3>
              <div className="flex flex-col gap-2.5 mb-8">
                {sideCollections.map(col => (
                  <Link
                    key={col.id}
                    to={`/coleccion/${col.slug}`}
                    className="flex gap-3 items-center bg-rock-card rounded-lg py-2.5 pl-2.5 pr-3.5
                               hover:bg-rock-cardHover transition-colors"
                  >
                    <span className="w-[46px] h-[46px] flex-none rounded-md bg-rock-border grid place-items-center
                                     font-display text-lg text-gray-500">
                      {col.title?.[0]?.toUpperCase() ?? '?'}
                    </span>
                    {/* El título envuelve a dos líneas en vez de cortarse: los
                        nombres de colección son frases, y "Los 50 discos esen…"
                        no dice cuál es. */}
                    <div className="min-w-0">
                      <p className="font-display text-[14.5px] leading-[1.2] line-clamp-2">{col.title}</p>
                      {col.source && <p className="text-[11.5px] text-gray-500 mt-0.5 truncate">{col.source}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Sin esto, alguien que no sigue a nadie ve el feed global sin
              entender por qué le aparece gente que no eligió. */}
          {noFollows && (
            <div className="bg-rock-accent/10 rounded-xl p-5">
              <p className="font-display text-lg mb-2 leading-tight">Todavía no seguís a nadie</p>
              <p className="text-[13.5px] text-gray-300 leading-relaxed mb-4">
                Así que esto es lo último de toda la comunidad. Elegí a quién escuchar y el
                feed se vuelve tuyo.
              </p>
              <Link to="/usuarios" className="btn btn-secondary">Buscar gente</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
