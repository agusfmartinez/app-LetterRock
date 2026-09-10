import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

/*
 * La validación es al submit y no al tipear: marcar en rojo un email a medio
 * escribir es decirle a alguien que se equivocó mientras todavía está
 * escribiendo bien. El error de cada campo vive debajo del campo; el del
 * servidor, arriba del botón, que es donde se produjo.
 */
function validate(mode, { email, password, username }) {
  const errors = {}
  if (mode === 'signup' && username.trim().length < 3) {
    errors.username = 'Al menos 3 caracteres.'
  }
  if (!email.trim()) {
    errors.email = 'Hace falta un email.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Ese email no parece válido.'
  }
  if (password.length < 6) {
    errors.password = 'Mínimo 6 caracteres.'
  }
  return errors
}

export default function LoginForm({ mode = 'login' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, signup } = useAuthStore()
  const navigate = useNavigate()

  const isSignup = mode === 'signup'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const found = validate(mode, { email, password, username })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setLoading(true)
    try {
      if (isSignup) {
        await signup(email, password, username)
        // Y no a Home directo: recién registrado no sigue a nadie ni tiene
        // favoritos, y esos dos son la materia prima de casi todo lo demás.
        navigate('/bienvenida')
      } else {
        await login(email, password)
        navigate('/')
      }
    } catch (err) {
      setError(err.message || 'No pudimos entrar. Probá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="card flex flex-col gap-4">
      {isSignup && (
        <div className="field">
          <label htmlFor="lr-user">Nombre de usuario</label>
          <input
            id="lr-user"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="comolequieras"
            autoComplete="username"
            aria-invalid={!!errors.username}
            className={`input ${errors.username ? 'border-rock-accent' : ''}`}
          />
          {errors.username ? (
            <span className="field-error">{errors.username}</span>
          ) : (
            <span className="block text-xs text-gray-500 mt-1.5">
              Al menos 3 caracteres. Es el que va a quedar en tu perfil.
            </span>
          )}
        </div>
      )}

      <div className="field">
        <label htmlFor="lr-mail">Email</label>
        <input
          id="lr-mail"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="vos@correo.com"
          autoComplete="email"
          aria-invalid={!!errors.email}
          className={`input ${errors.email ? 'border-rock-accent' : ''}`}
        />
        {errors.email && <span className="field-error">{errors.email}</span>}
      </div>

      <div className="field">
        <label htmlFor="lr-pass">Contraseña</label>
        <input
          id="lr-pass"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          aria-invalid={!!errors.password}
          className={`input ${errors.password ? 'border-rock-accent' : ''}`}
        />
        {errors.password ? (
          <span className="field-error">{errors.password}</span>
        ) : isSignup ? (
          <span className="block text-xs text-gray-500 mt-1.5">Mínimo 6 caracteres.</span>
        ) : null}
      </div>

      {error && (
        <p role="alert" className="text-sm text-rock-accentBright bg-rock-accent/10 rounded-md px-3 py-2.5">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn btn-primary btn-block mt-1">
        {loading ? 'Un momento…' : isSignup ? 'Crear cuenta' : 'Entrar'}
      </button>

      {isSignup && (
        <p className="text-[12.5px] text-gray-500 leading-relaxed">
          Después de crear la cuenta te pedimos tres bandas para armar tu feed. Son dos
          minutos y se puede saltear.
        </p>
      )}
    </form>
  )
}
