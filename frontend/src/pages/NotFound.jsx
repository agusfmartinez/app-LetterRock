import { Link } from 'react-router-dom'
import { IconDisc } from '../components/common/Icons'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center text-center py-24">
      <IconDisc className="w-16 h-16 text-rock-border mb-6" />
      <h1 className="text-3xl font-display font-semibold text-rock-text mb-2">Esta página no está en el catálogo</h1>
      <p className="text-gray-400 max-w-sm mb-8">
        El link puede estar roto o la página se movió. Volvamos a algo que sí existe.
      </p>
      <Link
        to="/"
        className="bg-rock-accent text-white px-5 py-2.5 rounded-lg font-medium hover:bg-rock-accentBright"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
