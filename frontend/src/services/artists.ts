/**
 * Cómo se lee `formed_year` según de quién sea la ficha.
 *
 * La columna guarda el comienzo de la vida del artista en MusicBrainz, que para
 * una banda es cuando se formó y para una persona es cuando nació. Es el mismo
 * dato, pero "Formado en 1950" debajo de Charly García está mal.
 *
 * `artist_type` puede venir vacío en las fichas cargadas antes de que la columna
 * existiera. En ese caso cae a la lectura de banda, que es la mayoría del
 * catálogo, y se arregla poniéndole el tipo desde el panel.
 */
export function isPerson(artist: any): boolean {
  return artist?.artist_type === 'person'
}

/** "Formado en 1972" / "Nació en 1951". `null` si no hay año. */
export function originLabel(artist: any): string | null {
  if (!artist?.formed_year) return null
  return isPerson(artist)
    ? `Nació en ${artist.formed_year}`
    : `Formado en ${artist.formed_year}`
}
