import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ArtistCard from '../components/common/ArtistCard'
import ReviewCard from '../components/common/ReviewCard'
import { supabase } from '../services/supabaseClient'

export default function Home() {
  const [recentArtists, setRecentArtists] = useState([])
  const [recentReviews, setRecentReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('artists').select('*').order('created_at', { ascending: false }).limit(12),
      supabase
        .from('reviews')
        .select('*, user:users(username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(5),
    ]).then(([{ data: artists }, { data: reviews }]) => {
      setRecentArtists(artists || [])
      setRecentReviews(reviews || [])
    }).finally(() => setLoading(false))
  }, [])

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

      {/* Recent Reviews */}
      {recentReviews.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-rock-text mb-4">Últimas opiniones</h2>
          <div className="space-y-3 max-w-2xl">
            {recentReviews.map(r => <ReviewCard key={r.id} review={r} />)}
          </div>
        </section>
      )}
    </div>
  )
}
