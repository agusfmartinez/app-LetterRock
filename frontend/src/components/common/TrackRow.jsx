import { useNavigate } from 'react-router-dom'
import { formatPlayCountCompact } from '../../hooks/useTopTracks'
import { trackDuration } from '../../services/dates'

/**
 * Un renglón del tracklist.
 *
 * `selected` lo gobierna el mismo `activeTrack` que el vinilo: pasar el mouse
 * por un surco resalta este renglón y pasar por este renglón resalta el surco.
 * Por eso el hover no se resuelve en CSS — tiene que avisar hacia afuera.
 */
export default function TrackRow({ track, index, selected, onHover }) {
  const navigate = useNavigate()
  const views = track.view_count
  const n = track.track_number ?? index + 1

  return (
    <div
      onClick={() => navigate(`/track/${track.id}`)}
      onMouseEnter={() => onHover?.(n)}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/track/${track.id}`)
        }
      }}
      className={`flex items-center gap-4 px-3.5 h-[46px] rounded-[14px] cursor-pointer
                  border-b border-rock-border/60 transition-colors ${
        selected ? 'bg-rock-accent/10' : 'hover:bg-rock-card'
      }`}
    >
      <span
        className={`font-mono text-xs w-6 flex-none ${
          selected ? 'text-rock-accent' : 'text-gray-500'
        }`}
      >
        {n}
      </span>

      <span className={`flex-1 min-w-0 truncate text-[15.5px] ${selected ? 'text-rock-accent' : ''}`}>
        {track.title}
      </span>

      {views != null && (
        <span
          className="text-gray-500 text-xs flex-none tabular-nums hidden sm:inline"
          title={`${views.toLocaleString('es-AR')} reproducciones en YouTube Music`}
        >
          ▶ {formatPlayCountCompact(views)}
        </span>
      )}

      <span className="text-gray-500 text-[13px] flex-none tabular-nums">
        {trackDuration(track) || '—'}
      </span>
    </div>
  )
}
