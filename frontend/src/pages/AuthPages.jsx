import { Link } from 'react-router-dom'
import LoginForm from '../components/forms/LoginForm'

const COPY = {
  login: {
    kicker: 'VOLVER AL ARCHIVO',
    title: 'Entrá y seguí donde ibas',
    lead: 'Tus puntajes, tus favoritos y las colecciones que armaste te están esperando.',
    altText: '¿Todavía no tenés cuenta?',
    altLabel: 'Crear una',
    altTo: '/auth/signup',
  },
  signup: {
    kicker: 'SUMARSE AL ARCHIVO',
    title: 'Escribí lo que escuchás',
    lead: 'Puntuá discos, guardá lo tuyo y armá recorridos que otros van a seguir.',
    altText: '¿Ya tenés cuenta?',
    altLabel: 'Entrar',
    altTo: '/auth/login',
  },
}

export default function AuthPages({ mode = 'login' }) {
  const copy = COPY[mode] || COPY.login

  return (
    <div className="flex flex-wrap gap-14 items-center py-12 animate-fade-up">
      <div className="flex-1 min-w-[270px]">
        <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 mb-3.5">
          {copy.kicker}
        </p>
        <h1 className="text-screen mb-4">{copy.title}</h1>
        <p className="text-[16.5px] leading-relaxed text-gray-300 max-w-[38ch] mb-9">
          {copy.lead}
        </p>

        {/* El mismo disco del home, quieto: acá no hay nada que celebrar
            todavía, y un giro infinito al lado de un formulario distrae. */}
        <div
          aria-hidden="true"
          className="rounded-full shadow-card-hover hidden sm:block"
          style={{
            width: 'min(250px, 54vw)',
            aspectRatio: '1',
            background: `
              radial-gradient(circle at 50% 50%, #100d0b 0 4%, transparent 5%),
              radial-gradient(circle at 50% 50%, #c1592c 5% 27%, transparent 27.5%),
              repeating-radial-gradient(circle at 50% 50%, #241d18 0 2.5px, #17120f 2.5px 5px)
            `,
          }}
        />
      </div>

      <div className="flex-1 min-w-[280px] max-w-[430px]">
        <LoginForm mode={mode} />
        <p className="text-center text-sm text-gray-400 mt-5">
          {copy.altText}{' '}
          <Link to={copy.altTo} className="font-semibold text-rock-accent hover:text-rock-accentBright">
            {copy.altLabel}
          </Link>
        </p>
      </div>
    </div>
  )
}
