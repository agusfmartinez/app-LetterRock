import { Link } from 'react-router-dom'
import { IconArrowRight, IconExternal } from './Icons'

/**
 * "Ver todas", "Ver en MusicBrainz" y compañía.
 *
 * Eran texto con una flecha tipográfica al final ("ver todas →"): se leían
 * como una frase más y no como algo que se toca, y en el teléfono el área
 * clickeable era el ancho de la palabra. Ahora son píldoras chicas con icono.
 *
 * `href` en vez de `to` = sale del sitio: abre en otra pestaña y lleva la
 * flecha en diagonal, que es la convención para eso.
 */
export default function ArrowLink({ to, href, children, className = '', ...rest }) {
  const cls = `btn btn-secondary !min-h-0 !px-3.5 !py-1.5 !text-[12.5px] gap-1.5 flex-none ${className}`

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...rest}>
        {children}
        <IconExternal size={13} />
      </a>
    )
  }

  // `rest` deja pasar `target="_blank"`: el panel abre las páginas públicas en
  // otra pestaña para no perder lo que se está editando.
  return (
    <Link to={to} className={cls} {...rest}>
      {children}
      <IconArrowRight size={13} />
    </Link>
  )
}
