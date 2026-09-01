import { Link } from 'react-router-dom'
import { useRole } from '../../hooks/useRole'
import { useAuthStore } from '../../store/authStore'

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
      <div className="max-w-2xl">
        <p className="text-red-400">Esta colección no es tuya.</p>
        <Link to="/colecciones" className="text-rock-accent hover:underline text-sm mt-2 block">
          Ver las colecciones →
        </Link>
      </div>
    )
  }
  return children
}
