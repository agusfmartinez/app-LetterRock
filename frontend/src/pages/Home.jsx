import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ActivityItem from '../components/common/ActivityItem'
import ArtistCard from '../components/common/ArtistCard'
import { useActivityFeed } from '../hooks/useActivityFeed'
import { useMyFollowing } from '../hooks/useFollows'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'

export default function Home() {
  const user = useAuthStore(s => s.user)
  const { data: following = [], isLoading: loadingFollowing } = useMyFollowing()

  // `null` = todavía no eligió nada y manda el default de abajo. En cuanto toca
  // una opción, esa gana y no se la volvemos a cambiar en el medio de la visita.
  const [choice, setChoice] = useState(null)
  const { data: recentArtists = [], isLoading: loading } = useQuery({
    queryKey: ['recent-artists'],
    queryFn: async () => {
      const { data } = await supabase
        .from('artists')
        .select('*')
        .eq('hidden', false)
        .order('created_at', { ascending: false })
        .limit(12)
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
  const { data: activity = [], isLoading: loadingActivity } = useActivityFeed(
    20,
    scoped ? following : undefined
  )

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-16 border-b border-rock-border">
        <h1 className="text-4xl md:text-6xl font-bold text-rock-text mb-4">
          🎸 <span className="text-rock-accent">LetterRock</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          La comunidad del rock nacional argentino. Descubrí, opiná, seguí.
        </p>
        <div className="mt-8 flex gap-4 justify-center flex-wrap">
          <Link
            to="/search"
            className="bg-rock-accent text-white px-6 py-2.5 rounded-lg font-semibold hover:opacity-90"
          >
            Explorar bandas
          </Link>
          <Link
            to="/auth/signup"
            className="border border-rock-border text-rock-text px-6 py-2.5 rounded-lg hover:border-rock-accent transition-colors"
          >
            Crear cuenta
          </Link>
        </div>
      </section>

      {/* Recent Artists */}
      <section>
        <h2 className="text-xl font-bold text-rock-text mb-4">Bandas en la comunidad</h2>
        {loading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : recentArtists.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>Todavía no hay bandas.</p>
            <Link to="/search" className="text-rock-accent hover:underline mt-2 block">
              Buscá la primera →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentArtists.map(a => <ArtistCard key={a.id} artist={a} />)}
          </div>
        )}
      </section>

      {/* Activity feed */}
      <section>
        <div className="flex items-baseline gap-4 mb-4 flex-wrap">
          <h2 className="text-xl font-bold text-rock-text">Actividad reciente</h2>
          {/* Sin sesión no hay a quién seguir, así que el filtro no aparece. */}
          {user && (
            <div className="flex gap-1 bg-rock-card border border-rock-border rounded-lg p-1">
              {[
                { value: false, label: 'Toda la comunidad' },
                { value: true, label: 'A quienes sigo' },
              ].map(({ value, label }) => (
                <button
                  key={label}
                  onClick={() => setChoice(value)}
                  className={`px-3 py-1 rounded text-xs transition-colors ${
                    onlyFollowing === value
                      ? 'bg-rock-accent text-white'
                      : 'text-gray-400 hover:text-rock-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Sin esto, alguien que no sigue a nadie ve el feed global sin entender
            por qué le aparece gente que no eligió. */}
        {user && !loadingFollowing && following.length === 0 && (
          <p className="text-gray-500 text-sm mb-3">
            Todavía no seguís a nadie, así que esto es lo último de toda la
            comunidad.{' '}
            <Link to="/usuarios" className="text-rock-accent hover:underline">
              Buscá a quién seguir →
            </Link>
          </p>
        )}

        {loadingActivity ? (
          <p className="text-gray-500">Cargando...</p>
        ) : activity.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {scoped
              ? 'Nadie de los que seguís hizo nada todavía.'
              : 'Todavía no hay actividad en la comunidad.'}
          </p>
        ) : (
          <div className="max-w-2xl bg-rock-card border border-rock-border rounded-lg px-4">
            {activity.map(a => <ActivityItem key={`${a.kind}-${a.id}`} activity={a} />)}
          </div>
        )}
      </section>
    </div>
  )
}
