import { Link } from 'react-router-dom'
import LoginForm from '../components/forms/LoginForm'

export default function AuthPages({ mode = 'login' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-rock-text">
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Crear cuenta'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {mode === 'login' ? 'Entrá a tu cuenta' : 'Unite a la comunidad de rock nacional'}
          </p>
        </div>

        <LoginForm mode={mode} />

        <p className="text-center text-gray-500 text-sm">
          {mode === 'login' ? (
            <>
              ¿No tenés cuenta?{' '}
              <Link to="/auth/signup" className="text-rock-accent hover:underline">
                Registrate
              </Link>
            </>
          ) : (
            <>
              ¿Ya tenés cuenta?{' '}
              <Link to="/auth/login" className="text-rock-accent hover:underline">
                Entrá
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
