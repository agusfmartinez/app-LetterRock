const CONTENT = {
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
      'LetterRock es un catálogo comunitario de rock nacional argentino. El contenido que se sube (reseñas, ediciones de fichas, colecciones) queda bajo licencia abierta para el resto de la comunidad.',
      'No se permite subir contenido que no te pertenece sin acreditarlo, ni usar la plataforma para spam o acoso a otros usuarios.',
      'Editores y administradores pueden corregir o revertir ediciones que tengan datos incorrectos.',
      'El servicio se ofrece tal cual está, sin garantía de disponibilidad continua.',
    ],
  },
}

export default function Legal({ page }) {
  const { title, body } = CONTENT[page]
  return (
    <div className="max-w-2xl mx-auto py-4">
      <h1 className="text-3xl font-display font-semibold text-rock-text mb-6">{title}</h1>
      <div className="space-y-4">
        {body.map((line, i) => (
          <p key={i} className="text-gray-300 leading-relaxed">{line}</p>
        ))}
      </div>
    </div>
  )
}
