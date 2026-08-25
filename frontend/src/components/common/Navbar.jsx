import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useRole } from '../../hooks/useRole'
import { useAuthStore } from '../../store/authStore'

export default function Navbar() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { isAdmin, isEditor } = useRole()

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <nav className="bg-rock-card border-b border-rock-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center gap-4 max-w-7xl">
        <Link to="/" className="text-rock-accent font-bold text-xl tracking-tight flex-shrink-0">
          🎸 LetterRock
        </Link>

        <Link
          to="/coleccion/historia-del-rock-argentino"
          className="hidden sm:block text-sm text-gray-300 hover:text-rock-accent flex-shrink-0"
        >
          Historia
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar bandas, álbumes..."
            className="w-full bg-rock-dark border border-rock-border rounded px-3 py-1.5 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
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
                className="text-sm bg-rock-accent text-white px-3 py-1 rounded hover:opacity-90"
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
