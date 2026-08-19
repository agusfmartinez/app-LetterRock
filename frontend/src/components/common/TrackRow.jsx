import { useNavigate } from 'react-router-dom'

function formatDuration(ms) {
  if (!ms) return '—'
  const secs = Math.floor(ms / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TrackRow({ track, index, selected }) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/track/${track.id}`)}
      className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer group transition-colors ${
        selected
          ? 'bg-rock-accent/10 border-l-2 border-rock-accent'
          : 'hover:bg-rock-dark'
      }`}
    >
      <span className={`text-sm w-6 text-right flex-shrink-0 ${
        selected ? 'text-rock-accent font-bold' : 'text-gray-500'
      }`}>
        {track.track_number ?? index + 1}
      </span>
      <span className={`flex-1 truncate ${
        selected ? 'text-rock-accent font-semibold' : 'text-rock-text group-hover:text-white'
      }`}>
        {track.title}
      </span>
      <span className="text-gray-500 text-sm flex-shrink-0">
        {formatDuration(track.duration_ms)}
      </span>
    </div>
  )
}
