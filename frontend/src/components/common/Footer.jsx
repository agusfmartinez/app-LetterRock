import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-rock-border bg-rock-card">
      <div className="mx-auto max-w-7xl px-4 py-10 flex flex-wrap gap-6 items-end">
        <div className="flex-1 min-w-[280px]">
          <p className="font-display text-lg mb-1.5">LetterRock</p>
          <p className="text-sm text-gray-500 max-w-[44ch]">
            Archivo abierto del rock argentino. Lo escribe quien lo escucha.
          </p>
        </div>

        <div className="flex flex-col gap-2 items-start">
          <p className="text-sm text-gray-500">
            Datos musicales:{' '}
            <a
              href="https://musicbrainz.org"
              className="text-rock-accent hover:text-rock-accentBright"
              target="_blank"
              rel="noreferrer"
            >
              MusicBrainz
            </a>
          </p>
          <div className="flex gap-4 text-sm">
            <Link to="/legal/privacidad" className="text-gray-400 hover:text-rock-text">Privacidad</Link>
            <Link to="/legal/terminos" className="text-gray-400 hover:text-rock-text">Términos</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
