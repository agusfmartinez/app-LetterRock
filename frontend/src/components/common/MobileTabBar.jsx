import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { IconHome, IconLayers, IconSearch, IconUser } from './Icons'

/*
 * La barra de solapas de abajo, que en mobile reemplaza a la hamburguesa. Es
 * fija y respeta el safe-area del iPhone; el `main` compensa su alto con un
 * padding propio para que nada quede tapado.
 *
 * Cuál está activa se deriva de la ruta — no hay estado guardado: si se
 * guardara, volver con el botón del navegador dejaría marcada la solapa
 * anterior.
 */
export default function MobileTabBar() {
  const user = useAuthStore(s => s.user)

  /*
   * La maqueta pide Home · Bandas · Colecciones · Buscar · Perfil, pero en el
   * repo "bandas" no tiene índice propio: el catálogo se recorre desde la
   * búsqueda. Gente tampoco: buscar personas es parte del mismo buscador que
   * las bandas. Quedan cuatro solapas antes que dos que van al mismo lado.
   */
  const tabs = [
    { to: '/', label: 'Home', Icon: IconHome, end: true },
    { to: '/search', label: 'Buscar', Icon: IconSearch },
    { to: '/colecciones', label: 'Colecciones', Icon: IconLayers },
    {
      to: user ? `/user/${user.username}` : '/auth/login',
      label: 'Perfil',
      Icon: IconUser,
    },
  ]

  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 flex safe-bottom
                 border-t border-rock-border bg-rock-dark/95 backdrop-blur-md"
    >
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink
          key={label}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 min-h-[54px] py-2 text-[10.5px] ${
              isActive ? 'text-rock-accent' : 'text-gray-400'
            }`
          }
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
