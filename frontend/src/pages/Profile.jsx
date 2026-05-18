import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ReviewCard from '../components/common/ReviewCard'
import { supabase } from '../services/supabaseClient'

export default function Profile() {
  const { username } = useParams()
  const [profile, setProfile] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('reviews')

  useEffect(() => {
    const run = async () => {
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single()

      setProfile(user)

      if (user) {
        const { data: userReviews } = await supabase
          .from('reviews')
          .select('*, user:users(username, avatar_url)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
        setReviews(userReviews || [])
      }

      setLoading(false)
    }
    run()
  }, [username])

  if (loading) return <p className="text-gray-500">Cargando...</p>
  if (!profile) return <p className="text-red-400">Usuario no encontrado.</p>

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Avatar + info */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-rock-accent flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          {profile.username[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-rock-text">{profile.username}</h1>
          {profile.bio && <p className="text-gray-400 text-sm mt-1">{profile.bio}</p>}
          <p className="text-gray-500 text-xs mt-1">{reviews.length} opiniones</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-rock-border">
        {['reviews', 'favoritos'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-rock-accent text-rock-text'
                : 'border-transparent text-gray-500 hover:text-rock-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'reviews' && (
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin opiniones aún.</p>
          ) : (
            reviews.map(r => <ReviewCard key={r.id} review={r} />)
          )}
        </div>
      )}

      {tab === 'favoritos' && (
        <p className="text-gray-500 text-sm">Los favoritos se mostrarán acá. (Fase 1.7)</p>
      )}
    </div>
  )
}
