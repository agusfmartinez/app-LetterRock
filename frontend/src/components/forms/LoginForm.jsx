import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function LoginForm({ mode = 'login' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, signup } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await signup(email, password, username)
      }
      navigate('/')
    } catch (err) {
      setError(err.message || 'Error de autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      {mode === 'signup' && (
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Nombre de usuario"
          required
          minLength={3}
          className="w-full bg-rock-dark border border-rock-border rounded px-4 py-2.5 text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
        />
      )}
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="w-full bg-rock-dark border border-rock-border rounded px-4 py-2.5 text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Contraseña"
        required
        minLength={6}
        className="w-full bg-rock-dark border border-rock-border rounded px-4 py-2.5 text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-rock-accent text-white py-2.5 rounded font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
      </button>
    </form>
  )
}
