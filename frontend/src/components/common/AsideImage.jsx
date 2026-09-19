/**
 * La imagen de la ficha, grande, en la columna derecha del panel.
 *
 * Muestra lo que está en el formulario aunque todavía no se haya guardado —
 * para eso la ficha le pasa el valor en vivo—, y lo avisa: si no, parecería
 * que el cambio ya está hecho.
 *
 * Sólo en escritorio: en el teléfono no hay columna al costado, y la vista
 * previa vuelve a quedar dentro del campo de imagen.
 */
export default function AsideImage({ src, saved, alt = '', round = false }) {
  const pending = (src || '') !== (saved || '')

  return (
    <div className="hidden lg:block space-y-2">
      <div className={`w-full aspect-square overflow-hidden bg-rock-card shadow-card grid place-items-center ${
        round ? 'rounded-full' : 'rounded-xl'
      }`}>
        {src ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover washed"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <span className="text-gray-500 text-sm">Sin imagen</span>
        )}
      </div>
      {pending && <p className="text-[12px] text-rock-accent text-center">Sin guardar</p>}
    </div>
  )
}
