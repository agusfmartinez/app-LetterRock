import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FollowButton from '../components/common/FollowButton'
import { IconGuitar } from '../components/common/Icons'
import { InlineSkeleton } from '../components/common/Skeleton'
import {
  MIN_FAVORITE_ARTISTS,
  useOnboardingArtists,
  useSaveOnboardingFavorites,
  useSuggestedUsers,
} from '../hooks/useOnboarding'
import { useAuthStore } from '../store/authStore'

function ArtistTile({ artist, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-left rounded-lg border overflow-hidden transition-colors ${
        selected ? 'border-rock-accent' : 'border-rock-border hover:border-gray-500'
      }`}
    >
      <div className="aspect-square bg-rock-dark relative">
        {artist.image_url ? (
          <img src={artist.image_url} alt={artist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <IconGuitar className="w-8 h-8" />
          </div>
        )}
        {selected && (
          <div className="absolute inset-0 bg-rock-accent/30 flex items-center justify-center">
            <span className="w-6 h-6 rounded-full bg-rock-accent text-white text-sm flex items-center justify-center">
              ✓
            </span>
          </div>
        )}
      </div>
      <p className="text-xs text-rock-text px-2 py-1.5 truncate">{artist.name}</p>
    </button>
  )
}

/**
 * Paso 1: elegir bandas favoritas.
 *
 * Es la materia prima de todo lo demás: sin favoritos no hay con qué calcular
 * afinidad, y el paso 2 quedaría vacío. Por eso pide un mínimo y no deja
 * avanzar sin él —pero sí deja saltarse el onboarding entero, que es distinto:
 * lo primero es una condición para que la función sirva, lo segundo es no
 * obligar a nadie a pasar por esto para poder usar la app—.
 */
function PickArtists({ selected, onToggle, onNext, onSkip }) {
  const [term, setTerm] = useState('')
  const { data: artists = [], isLoading } = useOnboardingArtists(term)
  const canContinue = selected.size >= MIN_FAVORITE_ARTISTS

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-rock-text">¿Qué bandas escuchás?</h1>
        <p className="text-gray-400 text-sm mt-1">
          Elegí al menos {MIN_FAVORITE_ARTISTS}. Las guardamos como favoritas y las
          usamos para sugerirte gente con gustos parecidos.
        </p>
      </div>

      <input
        value={term}
        onChange={e => setTerm(e.target.value)}
        placeholder="Buscar una banda..."
        className="w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent focus:ring-1 focus:ring-rock-accent"
      />

      {isLoading ? (
        <InlineSkeleton />
      ) : artists.length === 0 ? (
        <p className="text-gray-500 text-sm">
          Ninguna banda con ese nombre.{' '}
          <Link to="/search" className="text-rock-accent hover:underline">
            Buscala en el catálogo completo →
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {artists.map(a => (
            <ArtistTile key={a.id} artist={a} selected={selected.has(a.id)} onToggle={() => onToggle(a.id)} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="bg-rock-accent text-white px-5 py-2 rounded font-semibold hover:bg-rock-accentBright disabled:opacity-50"
        >
          Continuar
        </button>
        <span className="text-gray-500 text-sm">
          {selected.size} / {MIN_FAVORITE_ARTISTS}
        </span>
        <button onClick={onSkip} className="ml-auto text-sm text-gray-500 hover:text-rock-text">
          Saltear
        </button>
      </div>
    </div>
  )
}

/** Paso 2: a partir de esos favoritos, gente con gustos parecidos. */
function PickPeople({ onDone }) {
  const { data: suggestions = [], isLoading } = useSuggestedUsers(true)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-rock-text">Gente con gustos parecidos</h1>
        <p className="text-gray-400 text-sm mt-1">
          Comparten bandas favoritas con vos. Seguilos para verlos en tu inicio.
        </p>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Buscando...</p>
      ) : suggestions.length === 0 ? (
        <p className="text-gray-500 text-sm">
          Todavía no hay coincidencias —la comunidad es chica—.{' '}
          <Link to="/usuarios" className="text-rock-accent hover:underline">
            Buscá a alguien igual →
          </Link>
        </p>
      ) : (
        <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
          {suggestions.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-rock-accent flex items-center justify-center text-white font-bold flex-shrink-0">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                ) : (
                  u.username[0].toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-rock-text font-medium">{u.username}</p>
                <p className="text-gray-500 text-xs">
                  {u.shared_count} {u.shared_count === 1 ? 'banda en común' : 'bandas en común'}
                </p>
              </div>
              <FollowButton userId={u.id} />
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onDone}
        className="bg-rock-accent text-white px-5 py-2 rounded font-semibold hover:bg-rock-accentBright"
      >
        Ir al inicio
      </button>
    </div>
  )
}

/**
 * Onboarding de después del registro: bandas favoritas → gente afín.
 *
 * Dos pasos porque son dos preguntas distintas y la segunda depende de la
 * primera —recomendar gente necesita los favoritos ya guardados—, no porque
 * haga falta una sensación de proceso largo. Cualquiera de los dos se puede
 * saltear.
 */
export default function Onboarding() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [step, setStep] = useState('artists')
  const [selected, setSelected] = useState(new Set())
  const saveFavorites = useSaveOnboardingFavorites()

  // Se llega acá recién creada la cuenta, así que en el uso normal siempre hay
  // sesión. Este caso es para quien pega la URL a mano estando deslogueado:
  // sin `user.id` el guardado de favoritos no tiene a quién atribuírselos.
  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <p className="text-gray-400">Este paso es parte del registro.</p>
        <Link to="/auth/signup" className="text-rock-accent hover:underline text-sm mt-2 block">
          Crear cuenta →
        </Link>
      </div>
    )
  }

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const next = () => {
    saveFavorites.mutate(
      { userId: user.id, artistIds: [...selected] },
      { onSuccess: () => setStep('people') }
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      {step === 'artists' ? (
        <PickArtists
          selected={selected}
          onToggle={toggle}
          onNext={next}
          onSkip={() => navigate('/')}
        />
      ) : (
        <PickPeople onDone={() => navigate('/')} />
      )}
    </div>
  )
}
