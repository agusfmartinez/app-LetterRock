import { Link } from 'react-router-dom'
import { groupByPerson, lineupAt, roleLabel, useBandMembers } from '../../hooks/useArtistMembers'

/**
 * La formación de la banda en el año del disco.
 *
 * No se guarda: se deduce de las fechas de cada etapa. Un músico invitado que
 * tocó sólo en este disco sin ser parte de la banda no aparece acá —eso son
 * créditos del álbum, otra cosa— y un integrante que estaba pero no tocó en el
 * disco sí aparece. Es la formación de esa época, no la lista de ejecutantes.
 */
export default function AlbumLineup({ artistId, year, editHref, variant = 'list', people }) {
  // Con `people` la formación ya viene resuelta desde arriba: la timeline la
  // pide para todas sus bandas de una sola vez. Sin él, cada ficha suelta la
  // consulta por su cuenta.
  const { data: members = [] } = useBandMembers(people ? undefined : artistId)
  const lineup = lineupAt(people || groupByPerson(members), year)

  if (lineup.length === 0) return null

  // En la ficha del álbum la formación es un dato al margen, no el contenido:
  // en fila y compacta, para que no compita con el tracklist.
  if (variant === 'badges') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-500 text-xs uppercase tracking-wide">Integrantes</span>
        {lineup.map(person => {
          const target = person.slug
            ? `/artist/${person.slug}`
            : person.memberMbId
              ? `/musico/${person.memberMbId}`
              : null

          const label = person.roles.length > 0
            ? `${person.name} — ${person.roles.map(roleLabel).join(', ')}`
            : person.name

          const className = 'text-xs border border-rock-border rounded-full px-2.5 py-1 text-gray-300'

          return target ? (
            <Link
              key={person.key}
              to={target}
              title={label}
              className={`${className} hover:text-rock-accent hover:border-rock-accent`}
            >
              {person.name}
            </Link>
          ) : (
            <span key={person.key} title={label} className={className}>
              {person.name}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {lineup.map(person => {
        const target = person.slug
          ? `/artist/${person.slug}`
          : person.memberMbId
            ? `/musico/${person.memberMbId}`
            : null

        return (
          <div key={person.key} className="flex items-baseline gap-2 flex-wrap text-sm">
            {target ? (
              <Link to={target} className="text-rock-text hover:text-rock-accent">
                {person.name}
              </Link>
            ) : (
              <span className="text-rock-text">{person.name}</span>
            )}
            {person.roles.length > 0 && (
              <span className="text-gray-500 text-xs">
                {person.roles.map(roleLabel).join(' · ')}
              </span>
            )}
          </div>
        )
      })}

      {editHref && (
        <p className="text-gray-600 text-xs pt-2">
          Sale de las fechas de cada etapa.{' '}
          <Link to={editHref} className="hover:text-rock-accent underline">
            Corregirlas en el artista
          </Link>{' '}
          arregla todos los discos de esos años, no sólo éste.
        </p>
      )}
    </div>
  )
}
