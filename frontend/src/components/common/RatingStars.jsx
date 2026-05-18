import { useState } from 'react'

export default function RatingStars({ value = 0, max = 5, onRate, interactive = false }) {
  const [hover, setHover] = useState(0)
  const display = interactive ? (hover || value) : value

  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => i + 1).map(star => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onRate?.(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          className={`text-xl leading-none transition-colors ${
            star <= display ? 'text-rock-accent' : 'text-gray-600'
          } ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
