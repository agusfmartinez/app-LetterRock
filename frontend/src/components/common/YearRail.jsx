/**
 * Índice lateral de años. Fijo mientras se scrollea la época, marca en qué año
 * está parado el lector y permite saltar entre años.
 */
export default function YearRail({ groups, activeLabel, onSelect }) {
  if (groups.length < 2) return null

  return (
    <nav className="hidden lg:block w-24 flex-shrink-0">
      <ul className="sticky top-24 space-y-1 border-l border-rock-border pl-3">
        {groups.map(group => {
          const active = group.label === activeLabel
          return (
            <li key={group.label}>
              <button
                onClick={() => onSelect(group.label)}
                className={`block w-full text-left text-sm py-0.5 transition-colors ${
                  active
                    ? 'text-rock-accent font-bold'
                    : 'text-gray-600 hover:text-rock-text'
                }`}
              >
                {group.label}
                <span className="text-xs text-gray-700 ml-1">{group.entries.length}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
