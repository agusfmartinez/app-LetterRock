import { useEffect, useRef, useState } from 'react'
import { IconMore } from './Icons'

/**
 * El menú "⋯" de una fila del panel: las acciones que se usan poco (ocultar,
 * marcar, cambiar un rol) y que como botones sueltos competían con Editar.
 *
 * `items`: `[{ label, hint, onClick, danger }]`. `hint` es una línea chica que
 * explica qué hace — el menú se explica solo y la pantalla no necesita un
 * párrafo arriba contándolo.
 *
 * La tarjeta que contiene la fila no puede llevar `overflow-hidden`: el menú de
 * la última fila sale por debajo de ella.
 */
export default function RowMenu({ items, disabled = false, label = 'Más acciones' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Se cierra al tocar afuera o con Escape.
  useEffect(() => {
    if (!open) return
    const onDown = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!items.length) return null

  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn btn-secondary btn-icon"
      >
        <IconMore size={18} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-20 min-w-[230px] p-1.5
                     rounded-[14px] bg-rock-card border border-rock-border shadow-card animate-fade-up"
        >
          {items.map(it => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); it.onClick() }}
              // Lo que no se deshace va en rojo de verdad: el naranja de la
              // marca se confundía con una acción cualquiera.
              className={`w-full text-left px-3 py-2 rounded-[10px] text-[13.5px] ${
                it.danger ? 'hover:bg-red-500/10' : 'hover:bg-rock-cardHover'
              }`}
            >
              <span className={it.danger ? 'text-red-400' : ''}>{it.label}</span>
              {it.hint && <span className="block text-[11.5px] text-gray-500">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
