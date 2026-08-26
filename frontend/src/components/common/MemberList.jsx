import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isFeatured, roleLabel } from '../../hooks/useArtistMembers'

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
    <div className="flex items-baseline gap-x-3 gap-y-1 py-2 flex-wrap">
      <span className="flex items-baseline gap-2">
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
      </span>

      {person.roles.length > 0 && (
        <span className="text-gray-500 text-xs">{person.roles.map(roleLabel).join(' · ')}</span>
      )}

      <span className="text-gray-500 text-xs font-mono ml-auto">
        {person.periods.map(p => `(${p})`).join(' ')}
      </span>
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
