import { parsePlaylistUrl, playlistLabel } from '../../services/playlists'

/**
 * Campo para pegar el link de una playlist.
 *
 * Valida mientras se escribe y no al guardar: un link mal copiado se ve igual
 * de bien que uno bueno, y enterarse recién cuando la página quedó sin
 * reproductor es tarde.
 *
 * Se guarda la URL cruda; el parseo se rehace al mostrar. Guardar el id ya
 * extraído ahorraría poco y dejaría la fila sin el link original el día que un
 * servicio cambie de formato.
 */
export default function PlaylistField({ value, onChange, className = '' }) {
  const text = value || ''
  const ref = parsePlaylistUrl(text)
  const invalid = text.trim() !== '' && !ref

  return (
    <div className={className}>
      <input
        value={text}
        onChange={e => onChange(e.target.value)}
        placeholder="Link de una playlist de Spotify o YouTube (opcional)"
        className={`w-full bg-rock-dark border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent ${
          invalid ? 'border-red-500/60' : 'border-rock-border'
        }`}
      />
      {ref && (
        <p className="text-gray-500 text-xs mt-1">{playlistLabel(ref)} · se muestra al final de la página</p>
      )}
      {invalid && (
        <p className="text-red-400 text-xs mt-1">
          No reconocemos ese link. Tiene que ser una playlist o un álbum de Spotify,
          o una playlist de YouTube (las mixes automáticos que empiezan con RD no se
          pueden incrustar).
        </p>
      )}
    </div>
  )
}
