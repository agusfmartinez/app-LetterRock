/*
 * Orden y agrupado del tracklist.
 *
 * Un disco doble numera las pistas 1..n en cada disco, así que `track_number`
 * solo no alcanza para ordenar ni para identificar una canción: hay dos "3".
 * El orden es por disco y después por pista, y lo que identifica a una canción
 * en la lista es su posición (`pos`, arrancando en 1).
 */

export const trackNum = (t, i) => t.track_number ?? i + 1

const discOf = t => t.disc_number || 1

/** Copia ordenada por disco y pista. No toca el arreglo original. */
export function sortTracks(tracks = []) {
  return [...tracks].sort((a, b) =>
    discOf(a) - discOf(b) || (a.track_number ?? 0) - (b.track_number ?? 0)
  )
}

/**
 * Los discos de un álbum: `[{ disc, items: [{ track, pos }] }]`.
 *
 * `pos` es la posición en la lista entera, que es con lo que se hablan la
 * lista, los surcos del vinilo y la canción abierta.
 */
export function discGroups(tracks = []) {
  const out = []
  tracks.forEach((track, i) => {
    const disc = discOf(track)
    if (!out.length || out[out.length - 1].disc !== disc) out.push({ disc, items: [] })
    out[out.length - 1].items.push({ track, pos: i + 1 })
  })
  return out
}

/**
 * El disco (de un doble) al que pertenece una posición, o el primero.
 *
 * El vinilo dibuja un surco por canción: en un doble tiene que mostrar uno
 * solo por vez, o serían veinte surcos de un disco que no existe.
 */
export function discAt(groups, pos) {
  return groups.find(g => g.items.some(it => it.pos === pos)) || groups[0] || { disc: 1, items: [] }
}
