import { Link } from 'react-router-dom'
import { useRole } from '../../hooks/useRole'
import { EmptyState } from './States'

/** Esconde la UI de edición. La autorización real la hace RLS (`is_editor()`). */
export default function RequireEditor({ children }) {
  const { isEditor } = useRole()

  if (!isEditor) {
    return (
      <EmptyState
        title="Esta sección es de editores"
        action={<Link to="/" className="btn btn-secondary">Volver al inicio</Link>}
      >
        Tu cuenta no tiene permiso para editar el catálogo.
      </EmptyState>
    )
  }
  return children
}
