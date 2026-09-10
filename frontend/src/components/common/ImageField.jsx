import { useRef, useState } from 'react'
import { ACCEPTED_IMAGE_TYPES, uploadImage } from '../../services/storage'

const INPUT = 'input'

/**
 * Imagen de una ficha: se sube un archivo o se pega una URL.
 *
 * Las dos vías conviven a propósito. La subida es lo que se usa siempre, pero
 * pegar sigue siendo la forma de apuntar a una imagen que ya vive en otro lado
 * —las portadas y fotos que trae la ingesta de Spotify son URLs de Spotify— y
 * sacar el campo de texto obligaría a descargar y volver a subir cada una para
 * cambiar cualquier otra cosa de la ficha.
 *
 * Es controlado: no guarda nada por su cuenta, sólo avisa la URL nueva. Guardar
 * sigue siendo del formulario que lo contiene.
 */
export default function ImageField({ value, onChange, folder, placeholder = 'URL de imagen (opcional)' }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async (e) => {
    const file = e.target.files?.[0]
    // Limpiar el input antes de subir: sin esto, elegir el mismo archivo dos
    // veces seguidas no dispara el evento y parece que el botón no anda.
    e.target.value = ''
    if (!file) return

    setBusy(true)
    setError('')
    try {
      onChange(await uploadImage(file, folder))
    } catch (err) {
      setError(err.message || 'No se pudo subir la imagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 min-w-0 ${INPUT}`}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn btn-secondary flex-none"
        >
          {busy ? 'Subiendo...' : 'Subir'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        onChange={pick}
        className="hidden"
      />

      {error && <p className="text-rock-accentBright text-xs">{error}</p>}

      {value && (
        <div className="flex items-start gap-2">
          <img
            src={value}
            alt=""
            className="max-h-28 rounded-xl shadow-card"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-gray-500 hover:text-rock-accentBright"
          >
            Quitar
          </button>
        </div>
      )}
    </div>
  )
}
