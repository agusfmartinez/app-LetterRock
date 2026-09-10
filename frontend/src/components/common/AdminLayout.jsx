import { NavLink } from 'react-router-dom'
import { ROLE_LABEL, useRole } from '../../hooks/useRole'

/*
 * El panel es una sola cosa con secciones, aunque cada sección tenga su ruta:
 * quien entra a moderar usuarios y después va al catálogo no debería tener que
 * volver por el header. La nav es fija al costado en desktop y pasa a un rail
 * con scroll horizontal en mobile, como el resto de las solapas del sitio.
 *
 * Las pantallas de edición (un artista, un disco, una época) no la usan: ahí ya
 * se está adentro de una ficha y lo que corresponde es volver a ella.
 */
const SECTIONS = [
  { to: '/admin/descubrir', label: 'Descubrir', editor: true },
  { to: '/admin/catalogo', label: 'Catálogo', editor: true },
  { to: '/admin/colecciones', label: 'Colecciones', editor: true },
  { to: '/admin/users', label: 'Usuarios', adminOnly: true },
]

export default function AdminLayout({ title, lead, children }) {
  const { role, isAdmin } = useRole()
  const visible = SECTIONS.filter(s => !s.adminOnly || isAdmin)

  return (
    <div className="animate-fade-up">
      <div className="max-w-[60ch] py-9">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <h1 className="text-screen">{title}</h1>
          {role && role !== 'user' && <span className="tag tag-accent">{ROLE_LABEL[role]}</span>}
        </div>
        {lead && <p className="text-base leading-relaxed text-gray-300">{lead}</p>}
      </div>

      <div className="flex flex-wrap gap-8 items-start">
        <nav
          aria-label="Secciones del panel"
          className="w-full md:w-[208px] md:flex-none md:sticky md:top-[88px]
                     tab-rail md:flex-col md:gap-1"
        >
          {visible.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `whitespace-nowrap text-left text-[14.5px] px-4 py-2.5 rounded-full transition-colors ${
                  isActive
                    ? 'bg-rock-accent text-rock-text'
                    : 'text-gray-400 hover:text-rock-text hover:bg-rock-card'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1 min-w-[280px]">{children}</div>
      </div>
    </div>
  )
}
