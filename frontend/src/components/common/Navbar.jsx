import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useRole } from '../../hooks/useRole'
import { useAuthStore } from '../../store/authStore'
import { IconGuitar } from './Icons'

export default function Navbar() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useAuthStore()
  const { isAdmin, isEditor } = useRole()

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`hidden sm:block text-sm flex-shrink-0 pb-0.5 border-b-2 transition-colors ${
        pathname.startsWith(to)
          ? 'text-rock-text border-rock-accent'
          : 'text-gray-400 border-transparent hover:text-rock-text'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="bg-rock-card border-b border-rock-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center gap-5 max-w-7xl">
        <Link to="/" className="flex items-center gap-1.5 text-rock-accent font-display font-semibold text-lg tracking-tight flex-shrink-0">
          <IconGuitar className="w-5 h-5" />
          LetterRock
        </Link>

        {/* Al índice y no a una colección con el slug escrito acá: con dos
            colecciones cargadas, a la segunda no se llegaba desde ningún lado. */}
        {navLink('/colecciones', 'Colecciones')}

        {/* Sólo con sesión: sin cuenta no se puede seguir a nadie, así que el
            directorio no lleva a ninguna acción. */}
        {user && navLink('/usuarios', 'Usuarios')}

        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar bandas, artistas o usuarios..."
            className="w-full bg-rock-dark border border-rock-border rounded px-3 py-1.5 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent focus:ring-1 focus:ring-rock-accent transition-colors"
          />
        </form>

        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          {user ? (
            <>
              {isEditor && (
                <>
                  <Link to="/admin/colecciones" className="text-sm text-gray-500 hover:text-rock-accent">
                    Editor
                  </Link>
                  <Link to="/admin/catalogo" className="text-sm text-gray-500 hover:text-rock-accent">
                    Catálogo
                  </Link>
                </>
              )}
              {isAdmin && (
                <Link to="/admin/users" className="text-sm text-gray-500 hover:text-rock-accent">
                  Admin
                </Link>
              )}
              <Link to={`/user/${user.username}`} className="text-sm text-gray-300 hover:text-white">
                {user.username}
              </Link>
              <button onClick={logout} className="text-sm text-gray-500 hover:text-white">
                Salir
              </button>
            </>
          ) : (
            <>
              <Link to="/auth/login" className="text-sm text-gray-300 hover:text-white">
                Entrar
              </Link>
              <Link
                to="/auth/signup"
                className="text-sm bg-rock-accent text-white px-3 py-1.5 rounded font-medium hover:bg-rock-accentBright"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
