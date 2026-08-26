import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isFeatured, roleLabel } from '../../hooks/useArtistMembers'

/**
 * La foto del músico, o su inicial.
 *
 * Sólo tienen imagen los que están en el catálogo, que son minoría: la inicial
 * evita que la columna quede con huecos y mantiene todas las filas del mismo
 * alto, que es lo que hace legible una lista de veinte nombres.
 */
function Avatar({ person }) {
  if (person.image) {
    return (
      <img
        src={person.image}
        alt=""
        loading="lazy"
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    )
  }

  return (
    <span className="w-8 h-8 rounded-full bg-rock-dark border border-rock-border flex items-center justify-center flex-shrink-0 text-gray-600 text-xs">
      {person.name.charAt(0).toUpperCase()}
    </span>
  )
}

/**
 * Un músico y todo su paso por la banda en una sola fila.
 *
 * En la base cada etapa es su propia fila, pero leídas de corrido separan a la
 * misma persona en lugares lejanos de la lista: Charly García aparecía tres
 * veces con quince nombres en el medio, y así no se lee que entró, se fue y
 * volvió. Wikipedia resuelve lo mismo juntando los tramos entre paréntesis.
 */
function PersonRow({ person }) {
  const target = person.slug
    ? `/artist/${person.slug}`
    : person.memberMbId
      ? `/musico/${person.memberMbId}`
      : null

  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar person={person} />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-x-2 gap-y-1 flex-wrap">
          {target ? (
            <Link to={target} className="text-rock-text font-medium hover:text-rock-accent">
              {person.name}
            </Link>
          ) : (
            <span className="text-rock-text font-medium">{person.name}</span>
          )}

          {person.isOriginal && (
            <span className="text-[10px] uppercase tracking-wide text-rock-accent border border-rock-accent rounded px-1">
              original
            </span>
          )}

          {person.roles.length > 0 && (
            <span className="text-gray-500 text-xs">{person.roles.map(roleLabel).join(' · ')}</span>
          )}
        </div>

        <p className="text-gray-500 text-xs font-mono">
          {person.periods.map(p => `(${p})`).join(' ')}
        </p>
      </div>
    </div>
  )
}

export default function MemberList({ people }) {
  const [expanded, setExpanded] = useState(false)

  if (!people?.length) return null

  const featured = people.filter(isFeatured)
  // Si el criterio no destaca a nadie, no tiene sentido esconder la lista
  // entera detrás de un "ver más".
  const visible = expanded || featured.length === 0 ? people : featured
  const rest = people.length - visible.length

  return (
    <div>
      <div className="divide-y divide-rock-border">
        {visible.map(p => <PersonRow key={p.key} person={p} />)}
      </div>

      {(rest > 0 || expanded) && featured.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-rock-accent text-xs py-2"
        >
          {expanded
            ? 'Ver menos'
            : `Ver los otros ${rest} ${rest === 1 ? 'músico' : 'músicos'}`}
        </button>
      )}
    </div>
  )
}
