export default function Footer() {
  return (
    <footer className="bg-rock-card border-t border-rock-border py-6 mt-auto">
      <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
        <p>LetterRock — La comunidad del rock nacional argentino</p>
        <p className="mt-1">
          Datos musicales:{' '}
          <a
            href="https://musicbrainz.org"
            className="text-rock-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            MusicBrainz
          </a>
        </p>
      </div>
    </footer>
  )
}
