import { Link } from 'react-router-dom'
import { groupByPerson, lineupAt, roleLabel, useBandMembers } from '../../hooks/useArtistMembers'

/**
 * La cara del músico dentro de la chapita, como en la formación de la banda.
 *
 * Sólo tienen foto los que están en el catálogo, que son minoría: los demás
 * llevan su inicial para que todas las chapitas midan lo mismo. Sin la foto,
 * una fila de diez nombres iguales no dejaba reconocer a nadie de un vistazo.
 */
function Face({ person }) {
  if (person.image) {
    return (
      <img
        src={person.image}
        alt=""
        loading="lazy"
        className="w-[18px] h-[18px] rounded-full object-cover flex-none -ml-1.5"
      />
    )
  }

  return (
    <span className="w-[18px] h-[18px] rounded-full bg-rock-dark/60 grid place-items-center
                     flex-none -ml-1.5 text-[9px] text-gray-400">
      {person.name.charAt(0).toUpperCase()}
    </span>
  )
}

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
  //
  // El título va en su propio renglón: en la misma fila que los nombres, con
  // la columna angosta de la timeline, "Integrantes" quedaba colgado entre dos
  // chips y se leía como uno más.
  if (variant === 'badges') {
    return (
      <div>
        <p className="font-mono text-[9.5px] tracking-[0.16em] text-gray-500 mb-2.5">INTEGRANTES</p>
        <div className="flex items-center gap-1.5 flex-wrap">
        {lineup.map(person => {
          const target = person.slug
            ? `/artist/${person.slug}`
            : person.memberMbId
              ? `/musico/${person.memberMbId}`
              : null

          const label = person.roles.length > 0
            ? `${person.name} — ${person.roles.map(roleLabel).join(', ')}`
            : person.name

          const className = 'tag tag-neutral gap-1.5'

          return target ? (
            <Link
              key={person.key}
              to={target}
              title={label}
              className={`${className} hover:text-rock-accent hover:border-rock-accent`}
            >
              <Face person={person} />
              {person.name}
            </Link>
          ) : (
            <span key={person.key} title={label} className={className}>
              <Face person={person} />
              {person.name}
            </span>
          )
        })}
        </div>
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
        <p className="text-gray-500 text-xs pt-2">
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
