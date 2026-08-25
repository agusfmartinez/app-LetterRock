import { Link } from 'react-router-dom'
import { formatPeriod, roleLabel } from '../../hooks/useArtistMembers'

function Roles({ roles }) {
  if (!roles?.length) return null
  return (
    <span className="text-gray-500 text-xs">
      {roles.map(roleLabel).join(' · ')}
    </span>
  )
}

/**
 * Un músico y su etapa en la banda.
 *
 * El nombre enlaza a la trayectoria salvo que no haya con qué identificarlo:
 * las filas cargadas a mano pueden no tener id de MusicBrainz, y sin eso no se
 * puede agrupar el paso de esa persona por otras bandas.
 */
function MemberRow({ member }) {
  // La ficha del catálogo gana cuando existe: tiene bio, discos y reseñas. La
  // trayectoria es el destino de los que sólo figuran como integrantes.
  const target = member.member?.slug && !member.member.hidden
    ? `/artist/${member.member.slug}`
    : member.member_mb_id
      ? `/musico/${member.member_mb_id}`
      : null

  return (
    <div className="flex items-baseline gap-3 py-2 flex-wrap">
      <span className="text-gray-500 text-xs font-mono w-28 flex-shrink-0">
        {formatPeriod(member)}
      </span>

      <span className="flex items-baseline gap-2 flex-wrap">
        {target ? (
          <Link to={target} className="text-rock-text font-medium hover:text-rock-accent">
            {member.member_name}
          </Link>
        ) : (
          <span className="text-rock-text font-medium">{member.member_name}</span>
        )}

        {member.is_original && (
          <span className="text-[10px] uppercase tracking-wide text-rock-accent border border-rock-accent rounded px-1">
            original
          </span>
        )}
        <Roles roles={member.roles} />
      </span>
    </div>
  )
}

/**
 * La formación de una banda a lo largo del tiempo.
 *
 * Un mismo músico aparece una vez por etapa, no una sola vez con el rango
 * entero: Charly García estuvo en Sui Generis entre 1968 y 1975, volvió en 1981
 * y otra vez en 2000, y juntarlo en "1968 – 2001" diría algo que no pasó.
 */
export default function MemberList({ members }) {
  if (!members?.length) return null

  return (
    <div className="divide-y divide-rock-border">
      {members.map(m => <MemberRow key={m.id} member={m} />)}
    </div>
  )
}
