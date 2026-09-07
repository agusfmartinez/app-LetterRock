/**
 * Small custom line-icon set, one consistent stroke weight (1.6), replacing
 * the emoji used as placeholder art (🎸 💿 🎵) across cards and detail pages.
 * Kept minimal and hand-drawn rather than pulling in an icon library for
 * three shapes.
 */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconGuitar({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} {...base} aria-hidden="true">
      <path d="M14.5 3.5 20.5 9.5" />
      <path d="M16.8 5.2 19 3l1.9 1.9-2.2 2.3" />
      <path d="M13.2 6.8 8.8 11.2" />
      <circle cx="8" cy="16" r="4.3" />
      <circle cx="8" cy="16" r="1.3" />
      <path d="M11 13 14.5 9.5" />
    </svg>
  )
}

export function IconDisc({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} {...base} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6.2" strokeOpacity="0.5" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconNote({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} {...base} aria-hidden="true">
      <path d="M9 17.5V6l9-2v11.5" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="15.5" cy="15.5" r="2.5" />
    </svg>
  )
}
