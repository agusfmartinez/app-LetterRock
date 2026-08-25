/**
 * Marca un campo corregido a mano.
 *
 * La ingesta de Spotify reescribe título, fecha, portada y demás cada vez que
 * alguien entra al artista. Los campos marcados quedan excluidos de eso, y este
 * botón permite devolverlos al valor de origen.
 */
export default function ManualFieldMark({ field, manualFields, onRelease, className = '' }) {
  if (!manualFields?.includes(field)) return null

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] text-rock-accent ${className}`}>
      editado a mano
      {onRelease && (
        <button
          onClick={() => onRelease(field)}
          title="Volver al valor de Spotify en la próxima ingesta"
          className="text-gray-500 hover:text-red-400"
        >
          ✕
        </button>
      )}
    </span>
  )
}
