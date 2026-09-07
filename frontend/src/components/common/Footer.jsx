import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-rock-card border-t border-rock-border py-6 mt-auto">
      <div className="container mx-auto px-4 max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
        <p>LetterRock — La comunidad del rock nacional argentino</p>
        <div className="flex items-center gap-4">
          <a
            href="https://musicbrainz.org"
            className="hover:text-rock-accent"
            target="_blank"
            rel="noreferrer"
          >
            Datos musicales: MusicBrainz
          </a>
          <Link to="/privacidad" className="hover:text-rock-text">Privacidad</Link>
          <Link to="/terminos" className="hover:text-rock-text">Términos</Link>
        </div>
      </div>
    </footer>
  )
}
