import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useRole } from '../../hooks/useRole'
import { useAuthStore } from '../../store/authStore'
import { IconSearch, VinylMark } from './Icons'

/*
 * El header de escritorio. En mobile se reduce a marca + avatar: la navegación
 * baja a la barra de solapas (MobileTabBar), y con ella se va la hamburguesa.
 */
export default function Navbar() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { isAdmin, isEditor } = useRole()

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  /* El estado activo lo pone NavLink, no una comparación de pathname a mano. */
  const link = ({ isActive }) =>
    `text-sm transition-colors ${isActive ? 'text-rock-accent' : 'text-gray-300 hover:text-rock-text'}`

  return (
    <header className="sticky top-0 z-50 border-b border-rock-border bg-rock-dark/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5 flex-none text-rock-text">
          <VinylMark size={24} />
          <span className="font-display text-xl tracking-tight">LetterRock</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {/* Al índice y no a una colección con el slug escrito acá: con dos
              colecciones cargadas, a la segunda no se llegaba desde ningún lado. */}
          <NavLink to="/colecciones" className={link}>Colecciones</NavLink>
          {/* Sólo con sesión: sin cuenta no se puede seguir a nadie, así que el
              directorio no lleva a ninguna acción. */}
          {user && <NavLink to="/usuarios" className={link}>Gente</NavLink>}
          {isEditor && <NavLink to="/admin/catalogo" className={link}>Catálogo</NavLink>}
          {isAdmin && <NavLink to="/admin/users" className={link}>Panel</NavLink>}
        </nav>

        <div className="ml-auto flex items-center gap-3 flex-none">
          {/* Buscar sale del header en mobile: pasa a la barra de solapas. */}
          <form onSubmit={handleSearch} className="hidden md:flex relative items-center">
            <IconSearch size={15} className="absolute left-3 text-gray-500 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Bandas, discos, gente"
              className="input pl-9"
              style={{ width: 'min(240px, 34vw)' }}
            />
          </form>

          {user ? (
            <>
              <Link
                to={`/user/${user.username}`}
                title={user.username}
                className="w-9 h-9 rounded-full bg-rock-accent/20 border border-rock-accentDim grid place-items-center text-sm font-bold text-rock-accentBright hover:bg-rock-accent/30"
              >
                {user.username?.[0]?.toUpperCase() || '?'}
              </Link>
              <button onClick={logout} className="hidden md:block text-sm text-gray-500 hover:text-rock-text">
                Salir
              </button>
            </>
          ) : (
            <>
              <Link to="/auth/login" className="text-sm text-gray-300 hover:text-rock-text whitespace-nowrap">
                Entrar
              </Link>
              <Link to="/auth/signup" className="btn btn-primary !min-h-0 !px-4 !py-2">
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
