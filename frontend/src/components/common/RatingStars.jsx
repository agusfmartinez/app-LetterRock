import { useState } from 'react'
import { IconStar } from './Icons'

export default function RatingStars({ value = 0, max = 5, onRate, interactive = false, size = 'md' }) {
  const [hover, setHover] = useState(0)
  const display = interactive ? (hover || value) : value

  // `sm` es el de los renglones de meta del feed, donde el puntaje acompaña
  // a la fecha y no puede pesar más que el texto del evento.
  const px = interactive ? 24 : size === 'sm' ? 13 : 18

  return (
    <div
      className={size === 'sm' ? 'flex gap-0.5' : 'flex gap-1'}
      role={interactive ? 'group' : 'img'}
      aria-label={interactive ? undefined : `${value} de ${max}`}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map(star => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          aria-label={interactive ? `${star} ${star === 1 ? 'estrella' : 'estrellas'}` : undefined}
          onClick={() => interactive && onRate?.(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          className={`leading-none transition-transform ${
            star <= display ? 'text-rock-accent' : 'text-gray-600'
          } ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
        >
          <IconStar size={px} filled={star <= display} />
        </button>
      ))}
    </div>
  )
}
