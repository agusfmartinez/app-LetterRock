import { Link, useParams, Navigate } from 'react-router-dom'

/*
 * Privacidad y términos. Son dos documentos, no dos pantallas: comparten
 * layout y se eligen por ruta — así cada uno tiene su URL para linkear desde
 * el registro y el footer.
 */
const DOCS = {
  privacidad: {
    title: 'Privacidad',
    body: [
      'LetterRock guarda lo mínimo necesario para que la cuenta funcione: usuario, email y, si elegís conectar Spotify, el token de esa conexión.',
      'Las reseñas, calificaciones y colecciones que publicás son visibles para el resto de la comunidad — no son privadas.',
      'No vendemos datos a terceros. Los datos musicales (bandas, discos, integrantes) vienen de MusicBrainz y son públicos.',
      'Podés pedir que borremos tu cuenta y lo que publicaste escribiendo a soporte@letterrock.app.',
    ],
  },
  terminos: {
    title: 'Términos de uso',
    body: [
      'LetterRock es un catálogo comunitario de rock nacional argentino. El contenido que se sube — reseñas, ediciones de fichas, colecciones — queda bajo licencia abierta para el resto de la comunidad.',
      'No se permite subir contenido que no te pertenece sin acreditarlo, ni usar la plataforma para spam o acoso a otros usuarios.',
      'Editores y administradores pueden corregir o revertir ediciones que tengan datos incorrectos.',
      'El servicio se ofrece tal cual está, sin garantía de disponibilidad continua.',
    ],
  },
}

export default function Legal() {
  const { doc } = useParams()
  const current = DOCS[doc]

  /* Un documento que no existe no es un 404: es privacidad. */
  if (!current) return <Navigate to="/legal/privacidad" replace />

  return (
    <div className="max-w-[660px] py-8 animate-fade-up">
      {/* Solapas con scroll horizontal en mobile: dos no envuelven, pero la
          regla es la misma para todas las solapas de la app. */}
      <div className="tab-rail mb-7">
        {Object.entries(DOCS).map(([key, { title }]) => (
          <Link
            key={key}
            to={`/legal/${key}`}
            className={`btn ${key === doc ? 'btn-primary' : 'btn-secondary'}`}
          >
            {title}
          </Link>
        ))}
      </div>

      <h1 className="text-screen mb-7">{current.title}</h1>

      {current.body.map((text, i) => (
        <p key={i} className="text-[16.5px] leading-[1.7] text-gray-300 mb-5">
          {text}
        </p>
      ))}

      <p className="text-sm text-gray-500 mt-9">
        Última actualización: marzo 2026 ·{' '}
        <a href="mailto:soporte@letterrock.app" className="text-rock-accent hover:text-rock-accentBright">
          soporte@letterrock.app
        </a>
      </p>
    </div>
  )
}
