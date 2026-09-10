import { Link, useParams } from 'react-router-dom'
import MemberTimeline from '../components/common/MemberTimeline'
import { EmptyState, SkeletonFicha } from '../components/common/States'
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

  if (isLoading) return <div className="py-11"><SkeletonFicha lines={3} /></div>
  if (stages.length === 0) {
    return (
      <EmptyState title="Sin datos de este músico">
        No tenemos su paso por ninguna banda del archivo.
      </EmptyState>
    )
  }

  const name = stages[0].member_name
  // Una fila por banda, no por etapa: quien entró, se fue y volvió a la misma
  // banda se lee mejor junto que repetido a lo largo de la lista.
  const bands = groupByBand(stages)
  const allRoles = [...new Set(stages.flatMap(s => s.roles))].map(roleLabel)

  return (
    <div className="animate-fade-up">
      <div className="max-w-[60ch] py-9">
        <h1 className="text-screen mb-2.5">{name}</h1>
        <p className="text-[15px] text-gray-400 mb-2">
          {bands.length === 1 ? '1 banda' : `${bands.length} bandas`}
          {allRoles.length > 0 && ` · ${allRoles.join(' · ')}`}
        </p>
        <a
          href={`https://musicbrainz.org/artist/${mbId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] text-rock-accent hover:text-rock-accentBright"
        >
          Ver en MusicBrainz →
        </a>
        <p className="text-[14.5px] leading-relaxed text-gray-400 mt-5">
          No tiene ficha propia de artista: la mayoría de los integrantes no tiene
          discografía a su nombre. Lo que sí se puede ver es por dónde anduvo.
        </p>
      </div>

      <h2 className="font-display text-2xl mb-4">Trayectoria</h2>

      <div className="max-w-[740px] space-y-4">
        <div className="card">
          <MemberTimeline people={bands} />
        </div>

        <div className="card !p-0 overflow-hidden">
          {bands.map(band => (
            <div
              key={band.key}
              className="flex items-center gap-3.5 px-5 py-3.5 flex-wrap border-t border-rock-border first:border-t-0"
            >
              <div className="w-10 h-10 flex-none rounded-full overflow-hidden bg-rock-border grid place-items-center">
                {band.image ? (
                  <img src={band.image} alt="" className="w-full h-full object-cover washed" />
                ) : (
                  <span className="font-display text-sm text-gray-500">
                    {band.name?.[0]?.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-[150px]">
                {band.slug ? (
                  <Link to={`/artist/${band.slug}`} className="text-[15px] font-semibold hover:text-rock-accent">
                    {band.name}
                  </Link>
                ) : (
                  <span className="text-[15px] font-semibold">{band.name}</span>
                )}
                {band.roles.length > 0 && (
                  <p className="text-gray-500 text-[12.5px]">
                    {band.roles.map(roleLabel).join(' · ')}
                  </p>
                )}
              </div>

              <span className="text-gray-500 text-[12.5px] font-mono flex-none">
                {band.periods.map(p => `(${p})`).join(' ')}
              </span>

              {band.isOriginal && (
                <span className="tag tag-outline !text-[10px] tracking-[0.1em] flex-none">ORIGINAL</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
