import { Link } from 'react-router-dom'

/*
 * La pantalla completa de 404 es sólo para rutas que no existen. Para "este
 * disco no está" alcanza una línea dentro de la página — ver NotFoundLine en
 * components/common/States.jsx.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center text-center py-24 animate-fade-up">
      {/* Un disco apagado, sin el acento: acá no hay nada que celebrar. */}
      <div
        aria-hidden="true"
        // Sin resplandor (--quiet, y acá no hay grupo que lo encienda): apagado,
        // pero con el filo y los surcos para que se lea como disco.
        className="vinyl-disc vinyl-disc--quiet mb-8"
        style={{
          width: 'min(180px, 44vw)',
          aspectRatio: '1',
          '--vinyl-hole': '5%',
          '--vinyl-label': '#4a382c',
          '--vinyl-groove': '6px',
        }}
      />

      <p className="font-mono text-[10.5px] tracking-[0.16em] text-gray-500 mb-3.5">ERROR 404</p>

      <h1 className="text-screen max-w-[18ch] mb-4">
        Esta página no está en el catálogo
      </h1>

      <p className="text-base text-gray-400 leading-relaxed max-w-[40ch] mb-8">
        El link puede estar roto o la página se movió. Volvamos a algo que sí existe.
      </p>

      <div className="flex gap-3 flex-wrap justify-center">
        <Link to="/" className="btn btn-primary px-6 py-3">Volver al inicio</Link>
        <Link to="/search" className="btn btn-secondary px-6 py-3">Buscar en el catálogo</Link>
      </div>
    </div>
  )
}
