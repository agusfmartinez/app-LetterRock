import { Link } from 'react-router-dom'
import { useRole } from '../../hooks/useRole'
import { useAuthStore } from '../../store/authStore'
import { EmptyState } from './States'

/**
 * Deja pasar al dueño de la colección o a un editor.
 *
 * `RequireEditor` no sirve acá desde que cualquiera puede armar la suya: el
 * permiso ya no depende del rol sino de quién la creó. Esconde la UI nada más
 * —quien autoriza de verdad son las policies, que preguntan lo mismo—, pero sin
 * esto el dueño de una colección vería la pantalla de "no tenés permisos" sobre
 * su propio contenido.
 */
export default function RequireCollectionOwner({ collection, children }) {
  const { isEditor } = useRole()
  const user = useAuthStore(s => s.user)

  const allowed = isEditor || (!!user && collection?.created_by === user.id)

  if (!allowed) {
    return (
      <EmptyState
        title="Esta colección no es tuya"
        action={<Link to="/colecciones" className="btn btn-secondary">Ver las colecciones</Link>}
      >
        Sólo su dueño o un editor pueden cambiarla.
      </EmptyState>
    )
  }
  return children
}
