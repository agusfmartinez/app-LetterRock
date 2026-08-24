import { Link } from 'react-router-dom'
import { useRole } from '../../hooks/useRole'

/** Esconde la UI de edición. La autorización real la hace RLS (`is_editor()`). */
export default function RequireEditor({ children }) {
  const { isEditor } = useRole()

  if (!isEditor) {
    return (
      <div className="max-w-2xl">
        <p className="text-red-400">No tenés permisos para editar contenido.</p>
        <Link to="/" className="text-rock-accent hover:underline text-sm mt-2 block">
          Volver al inicio →
        </Link>
      </div>
    )
  }
  return children
}
