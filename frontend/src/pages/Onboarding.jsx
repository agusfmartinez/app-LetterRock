import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FollowButton from '../components/common/FollowButton'
import { EmptyState, SkeletonGrid, SkeletonRows } from '../components/common/States'
import { IconCheck, IconSearch } from '../components/common/Icons'
import {
  MIN_FAVORITE_ARTISTS,
  useOnboardingArtists,
  useSaveOnboardingFavorites,
  useSuggestedUsers,
} from '../hooks/useOnboarding'
import { useAuthStore } from '../store/authStore'

/*
 * Elegir una banda es marcarla, no abrirla: por eso el anillo de acento y el
 * tilde, y no un borde de tarjeta. El retrato es redondo como en el resto del
 * sitio — una banda siempre se ve igual, se la esté eligiendo o no.
 */
function ArtistTile({ artist, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className="text-center group"
    >
      <div
        className={`relative aspect-square rounded-full p-1 transition-colors ${
          selected ? 'bg-rock-accent' : 'bg-transparent'
        }`}
      >
        <div className="w-full h-full rounded-full overflow-hidden bg-rock-border grid place-items-center">
          {artist.image_url ? (
            <img
              src={artist.image_url}
              alt=""
              loading="lazy"
              className={`w-full h-full object-cover transition-[filter] ${
                selected ? '' : 'washed group-hover:filter-none'
              }`}
            />
          ) : (
            <span className="font-display text-2xl text-gray-500">
              {artist.name?.[0]?.toUpperCase()}
            </span>
          )}
        </div>
        {selected && (
          <span className="absolute right-0.5 bottom-0.5 w-7 h-7 rounded-full bg-rock-accent
                           text-rock-dark grid place-items-center border-2 border-rock-dark">
            <IconCheck size={14} />
          </span>
        )}
      </div>
      <p className={`text-[13.5px] mt-2.5 leading-tight ${selected ? 'text-rock-accent' : 'text-gray-300'}`}>
        {artist.name}
      </p>
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
    <div>
      <div className="max-w-[640px] pb-7">
        <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 mb-3.5">PASO 1 DE 2</p>
        <h1 className="text-screen mb-3.5">¿Qué bandas escuchás?</h1>
        <p className="text-base leading-relaxed text-gray-300 max-w-[50ch]">
          Elegí al menos {MIN_FAVORITE_ARTISTS}. Las guardamos como favoritas y las
          usamos para sugerirte gente con gustos parecidos.
        </p>
      </div>

      <div className="relative flex items-center max-w-[360px] mb-8">
        <IconSearch size={15} className="absolute left-4 text-gray-500 pointer-events-none" />
        <input
          value={term}
          onChange={e => setTerm(e.target.value)}
          placeholder="Buscar una banda"
          aria-label="Buscar una banda"
          className="input pl-10 !min-h-[46px]"
        />
      </div>

      {isLoading ? (
        <SkeletonGrid count={12} min={122} />
      ) : artists.length === 0 ? (
        <EmptyState
          title="Ninguna banda con ese nombre"
          action={<Link to="/search" className="btn btn-secondary">Buscar en el catálogo</Link>}
        >
          Puede que todavía no esté fichada en el archivo.
        </EmptyState>
      ) : (
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(122px,1fr))' }}>
          {artists.map(a => (
            <ArtistTile key={a.id} artist={a} selected={selected.has(a.id)} onToggle={() => onToggle(a.id)} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-5 flex-wrap pt-6 mt-9 border-t border-rock-border max-w-[760px]">
        <button onClick={onNext} disabled={!canContinue} className="btn btn-primary px-6 py-3">
          Continuar
        </button>
        <span className="font-mono text-[12.5px] text-gray-500">
          {selected.size} / {MIN_FAVORITE_ARTISTS}
        </span>
        <button onClick={onSkip} className="ml-auto btn btn-ghost text-[13.5px] !text-gray-400">
          Saltear por ahora
        </button>
      </div>
    </div>
  )
}

/** Paso 2: a partir de esos favoritos, gente con gustos parecidos. */
function PickPeople({ onDone, onBack }) {
  const { data: suggestions = [], isLoading } = useSuggestedUsers(true)

  return (
    <div>
      <div className="max-w-[640px] pb-7">
        <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 mb-3.5">PASO 2 DE 2</p>
        <h1 className="text-screen mb-3.5">Gente con gustos parecidos</h1>
        <p className="text-base leading-relaxed text-gray-300 max-w-[50ch]">
          Comparten bandas favoritas con vos. Seguilos y su actividad te aparece en el feed.
        </p>
      </div>

      <div className="max-w-[620px]">
        {isLoading ? (
          <SkeletonRows count={3} />
        ) : suggestions.length === 0 ? (
          <EmptyState
            title="Todavía no hay coincidencias"
            action={<Link to="/usuarios" className="btn btn-secondary">Ver toda la gente</Link>}
          >
            La comunidad es chica y nadie comparte tus bandas todavía.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-2.5 mb-8">
            {suggestions.map(u => (
              <div key={u.id} className="flex items-center gap-3.5 card !py-3">
                <div className="w-11 h-11 flex-none rounded-full overflow-hidden bg-rock-accent/20
                                border border-rock-accentDim grid place-items-center
                                text-rock-accentBright font-bold">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                  ) : (
                    u.username[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[14.5px]">{u.username}</p>
                  <p className="text-gray-500 text-[12.5px]">
                    {u.shared_count} {u.shared_count === 1 ? 'banda en común' : 'bandas en común'}
                  </p>
                </div>
                <FollowButton userId={u.id} />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-5 flex-wrap">
          <button onClick={onDone} className="btn btn-primary px-6 py-3">Ir al inicio</button>
          <button onClick={onBack} className="btn btn-ghost text-[13.5px] !text-gray-400">
            ← Volver a las bandas
          </button>
        </div>
      </div>
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
      <EmptyState
        title="Este paso es parte del registro"
        action={<Link to="/auth/signup" className="btn btn-primary">Crear cuenta</Link>}
      >
        Para guardar tus bandas favoritas hace falta una cuenta.
      </EmptyState>
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
    <div className="py-8 animate-fade-up">
      {step === 'artists' ? (
        <PickArtists
          selected={selected}
          onToggle={toggle}
          onNext={next}
          onSkip={() => navigate('/')}
        />
      ) : (
        <PickPeople onDone={() => navigate('/')} onBack={() => setStep('artists')} />
      )}
    </div>
  )
}
