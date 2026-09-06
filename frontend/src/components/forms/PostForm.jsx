import { useState } from 'react'
import { POST_MAX, useCatalogSearch, usePostMutations } from '../../hooks/usePosts'
import { ENTITY_NOUN } from '../../services/entities'
import { useAuthStore } from '../../store/authStore'

const INPUT =
  'w-full bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent'

/**
 * Buscador para colgar el posteo de algo del catálogo.
 *
 * Se abre sólo si lo pedís: la mayoría de los posteos no adjuntan nada, y un
 * buscador siempre desplegado sugiere lo contrario.
 */
function AttachPicker({ onPick, onClose }) {
  const [query, setQuery] = useState('')
  const { data: hits = [], isLoading } = useCatalogSearch(query)

  return (
    <div className="border border-rock-border rounded p-2 space-y-2">
      <input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar un tema, disco o banda"
        className={INPUT}
      />

      {query.trim().length >= 2 && (
        isLoading ? (
          <p className="text-gray-500 text-xs">Buscando...</p>
        ) : hits.length === 0 ? (
          <p className="text-gray-500 text-xs">
            No hay nada con ese nombre en el catálogo todavía.
          </p>
        ) : (
          <ul className="max-h-52 overflow-y-auto">
            {hits.map(hit => (
              <li key={`${hit.entity_type}-${hit.entity_id}`}>
                <button
                  onClick={() => onPick(hit)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-rock-dark"
                >
                  <span className="text-rock-text text-sm">{hit.label}</span>
                  <span className="text-gray-500 text-xs ml-2">
                    {hit.sub ? `${hit.sub} · ` : ''}
                    {ENTITY_NOUN[hit.entity_type].replace(/^(el|la) /, '')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      <button onClick={onClose} className="text-xs text-gray-500 hover:text-rock-text">
        Cancelar
      </button>
    </div>
  )
}

/**
 * Escribir algo para el feed.
 *
 * Es lo único que se publica sin ser sobre nada en particular. Una review
 * necesita un disco y un favorito necesita una banda; un posteo puede ser
 * "anoche vi a Spinetta" y nada más. El adjunto es opcional justamente por eso.
 *
 * No lleva puntaje: puntuar ya tiene su lugar, y una opinión sobre un disco con
 * estrellas es una review. Dos formas de hacer lo mismo terminan compitiendo.
 */
export default function PostForm() {
  const user = useAuthStore(s => s.user)
  const { createPost } = usePostMutations()
  const [body, setBody] = useState('')
  const [attached, setAttached] = useState(null)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')

  if (!user) return null

  const left = POST_MAX - body.length
  const canSend = body.trim().length > 0 && left >= 0 && !createPost.isPending

  const submit = (e) => {
    e.preventDefault()
    if (!canSend) return
    createPost.mutate(
      {
        user_id: user.id,
        body: body.trim(),
        entity_type: attached?.entity_type ?? null,
        entity_id: attached?.entity_id ?? null,
      },
      {
        onSuccess: () => {
          setBody('')
          setAttached(null)
          setError('')
        },
        onError: err => setError(err.message),
      }
    )
  }

  return (
    <form onSubmit={submit} className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="¿Qué estás escuchando?"
        rows={3}
        className={INPUT}
      />

      {attached && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Sobre</span>
          <span className="text-rock-text">{attached.label}</span>
          <button
            type="button"
            onClick={() => setAttached(null)}
            className="text-gray-500 hover:text-red-400 text-xs"
          >
            quitar
          </button>
        </div>
      )}

      {picking && (
        <AttachPicker
          onPick={hit => {
            setAttached(hit)
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={!canSend}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Postear
        </button>
        {!picking && !attached && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="text-sm text-gray-500 hover:text-rock-accent"
          >
            + Adjuntar algo
          </button>
        )}
        {/* El contador aparece cerca del límite y no desde el carácter uno:
            antes de eso es ruido sobre un problema que nadie tiene. */}
        {left <= 80 && (
          <span className={`text-xs ml-auto ${left < 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {left}
          </span>
        )}
      </div>
    </form>
  )
}
