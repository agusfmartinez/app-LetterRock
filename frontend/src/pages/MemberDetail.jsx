import { Link, useParams } from 'react-router-dom'
import MemberTimeline from '../components/common/MemberTimeline'
import { groupByBand, roleLabel, useMemberTrajectory } from '../hooks/useArtistMembers'

/**
 * El paso de un músico por las bandas.
 *
 * No es una ficha de artista: la mayoría de los integrantes no tiene
 * discografía propia ni entrada en Wikipedia, y forzarles un perfil vacío no
 * agrega nada. Lo que sí tiene sentido es ver por dónde anduvo y cuándo.
 *
 * Los que además son artistas del catálogo tienen su ficha en /artist/:slug, y
 * la formación de la banda enlaza directo ahí.
 */
export default function MemberDetail() {
  const { mbId } = useParams()
  const { data: stages = [], isLoading } = useMemberTrajectory(mbId)

  if (isLoading) return <p className="text-gray-500">Cargando...</p>
  if (stages.length === 0) {
    return <p className="text-gray-500">No hay datos de este músico.</p>
  }

  const name = stages[0].member_name
  // Una fila por banda, no por etapa: quien entró, se fue y volvió a la misma
  // banda se lee mejor junto que repetido a lo largo de la lista.
  const bands = groupByBand(stages)
  const allRoles = [...new Set(stages.flatMap(s => s.roles))].map(roleLabel)

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-rock-text">{name}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {bands.length === 1 ? '1 banda' : `${bands.length} bandas`}
          {allRoles.length > 0 && ` · ${allRoles.join(' · ')}`}
        </p>
        <a
          href={`https://musicbrainz.org/artist/${mbId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 hover:text-rock-accent text-xs"
        >
          Ver en MusicBrainz →
        </a>
      </div>

      <div>
        <h2 className="text-xl font-bold text-rock-text mb-3">Trayectoria</h2>

        <div className="space-y-4">
          <div className="bg-rock-card border border-rock-border rounded-lg p-4">
            <MemberTimeline people={bands} />
          </div>

          <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
            {bands.map(band => (
              <div key={band.key} className="flex items-center gap-3 p-3 flex-wrap">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-rock-dark flex-shrink-0">
                  {band.image ? (
                    <img src={band.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm">🎸</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {band.slug ? (
                    <Link
                      to={`/artist/${band.slug}`}
                      className="text-rock-text font-medium hover:text-rock-accent"
                    >
                      {band.name}
                    </Link>
                  ) : (
                    <span className="text-rock-text font-medium">{band.name}</span>
                  )}
                  {band.roles.length > 0 && (
                    <p className="text-gray-500 text-xs">
                      {band.roles.map(roleLabel).join(' · ')}
                    </p>
                  )}
                </div>

                <span className="text-gray-500 text-xs font-mono flex-shrink-0">
                  {band.periods.map(p => `(${p})`).join(' ')}
                </span>

                {band.isOriginal && (
                  <span className="text-[10px] uppercase tracking-wide text-rock-accent border border-rock-accent rounded px-1 flex-shrink-0">
                    original
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
