const db = require('./supabaseService')
const spotify = require('./spotifyService')
const youtube = require('./youtubeService')

// El catálogo de un canal se reusa entre álbumes del mismo artista.
const catalogCache = new Map()
const CATALOG_TTL_MS = 10 * 60 * 1000

// Un artista a la vez, y no se reintenta lo que ya falló: sin esto, cada visita
// a la página de un artista sin canal en YouTube gastaría 100 unidades de nuevo.
const inFlight = new Set()
const failed = new Set()

function isLinking(artistId) {
  return inFlight.has(artistId)
}

async function getCatalog(channelId) {
  const cached = catalogCache.get(channelId)
  if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.catalog

  const catalog = await youtube.getChannelCatalog(channelId)
  catalogCache.set(channelId, { at: Date.now(), catalog })
  return catalog
}

/**
 * Canal "- Topic" del artista: de la DB si ya se resolvió, de la API si no.
 * Devuelve `null` cuando no hay canal o cuando no queda presupuesto.
 */
async function resolveChannel(artist, { auto }) {
  const links = await db.getMediaLinks('artist', [artist.id])
  const known = links.find(l => l.provider === 'youtube')?.external_id
  if (known) return { channelId: known, wasCached: true }

  if (!youtube.hasBudgetFor(youtube.COST.search, { auto })) {
    return { channelId: null, reason: 'presupuesto' }
  }

  const channel = await youtube.findArtistTopicChannel(artist.name)
  if (!channel) return { channelId: null, reason: 'sin-canal' }

  await db.saveMediaLinks([{
    entity_type: 'artist',
    entity_id: artist.id,
    provider: 'youtube',
    external_id: channel.channelId,
    url: `https://www.youtube.com/channel/${channel.channelId}`,
  }])

  return { channelId: channel.channelId, wasCached: false }
}

/**
 * Tracks del álbum, ingestándolos de Spotify si todavía no están.
 *
 * Normalmente los trae la visita a la página del álbum, pero acá se fuerza: si
 * no, vincular la discografía dependería de haber entrado antes a cada disco a
 * mano. Spotify no tiene cupo diario, así que la llamada extra no cuesta nada
 * relevante.
 */
async function ensureTracks(album) {
  const existing = await db.getTracksByAlbum(album.id)
  if (existing.length) return { tracks: existing, ingested: false }

  if (!album.external_spotify_id) return { tracks: [], ingested: false }

  const spotifyTracks = await spotify.getAlbumTracks(album.external_spotify_id)
  const saved = await db.saveTracks(spotifyTracks, album.id)
  console.log(`[YouTube link] ${album.title}: ${saved.length} tracks ingestados de Spotify`)
  return { tracks: saved, ingested: true }
}

/** Guarda los links de un álbum ya cruzado contra el catálogo. */
async function saveAlbumMatches(matches) {
  if (!matches.length) return
  const now = new Date().toISOString()
  await db.saveMediaLinks(matches.map(m => ({
    entity_type: 'track',
    entity_id: m.track.id,
    provider: 'youtube',
    external_id: m.video.videoId,
    url: `https://music.youtube.com/watch?v=${m.video.videoId}`,
    play_count: m.video.views ?? null,
    play_count_updated_at: now,
  })))
}

/**
 * Vincula toda la discografía del artista en una sola bajada del catálogo.
 *
 * El canal se lee entero de todas formas, así que hacer los diez álbumes cuesta
 * lo mismo que hacer uno. Los discos que todavía no tienen tracks se ingestan
 * de Spotify sobre la marcha.
 */
async function linkArtistDiscography(artist, { auto = false } = {}) {
  if (inFlight.has(artist.id)) return { skipped: 'en-curso' }
  if (auto && failed.has(artist.id)) return { skipped: 'falló-antes' }

  inFlight.add(artist.id)
  try {
    const { channelId, reason, wasCached } = await resolveChannel(artist, { auto })
    if (!channelId) {
      if (reason === 'sin-canal') failed.add(artist.id)
      return { skipped: reason }
    }

    if (!youtube.hasBudgetFor(20, { auto })) return { skipped: 'presupuesto' }

    const catalog = await getCatalog(channelId)
    const albums = await db.getAlbumsByArtist(artist.id)

    const results = []
    for (const album of albums) {
      let tracks = []
      let ingested = false
      try {
        ({ tracks, ingested } = await ensureTracks(album))
      } catch (err) {
        console.error('[YouTube link] tracks', album.title, err.message)
      }

      if (!tracks.length) {
        results.push({ album: album.title, skipped: 'sin-tracks-en-spotify' })
        continue
      }

      const { matches, albumFound } = youtube.matchAlbumTracks(tracks, catalog, album.title)
      if (!albumFound) {
        results.push({ album: album.title, skipped: 'no-está-en-el-canal' })
        continue
      }

      await saveAlbumMatches(matches)
      results.push({
        album: album.title,
        matched: matches.length,
        total: tracks.length,
        ...(ingested && { ingested: true }),
      })
    }

    const linked = results.filter(r => r.matched > 0)
    console.log(
      `[YouTube] ${artist.name}: ${linked.length}/${albums.length} álbumes vinculados` +
      ` (${linked.reduce((sum, r) => sum + r.matched, 0)} temas)`
    )

    return { channelId, channelWasCached: wasCached, albums: results }
  } catch (err) {
    console.error('[YouTube link]', artist.name, err.message)
    if (err.status === 429) return { skipped: 'cuota-agotada' }
    failed.add(artist.id)
    throw err
  } finally {
    inFlight.delete(artist.id)
  }
}

/** Igual que lo anterior pero para un álbum solo, desde el editor. */
async function linkAlbum(album, artist) {
  const { tracks } = await ensureTracks(album)
  if (!tracks.length) {
    const err = new Error('El álbum no tiene canciones en Spotify')
    err.status = 409
    throw err
  }

  const { channelId, reason } = await resolveChannel(artist, { auto: false })
  if (!channelId) {
    const err = new Error(
      reason === 'presupuesto'
        ? 'Se agotó el presupuesto de cuota de YouTube por hoy'
        : `No se encontró el canal "${artist.name} - Topic" en YouTube`
    )
    err.status = reason === 'presupuesto' ? 429 : 404
    throw err
  }

  const catalog = await getCatalog(channelId)
  const { matches, albumFound } = youtube.matchAlbumTracks(tracks, catalog, album.title)

  if (!albumFound) {
    const err = new Error(`El canal no tiene el álbum "${album.title}"`)
    err.status = 404
    err.availableAlbums = youtube.albumsInCatalog(catalog).slice(0, 40)
    throw err
  }

  await saveAlbumMatches(matches)

  return {
    channelId,
    matched: matches.length,
    total: tracks.length,
    partial: matches.filter(m => m.matchedBy === 'partial').length,
    unmatched: tracks.filter(t => !matches.some(m => m.track.id === t.id)).map(t => t.title),
    top: [...matches]
      .sort((a, b) => (b.video.views || 0) - (a.video.views || 0))
      .slice(0, 4)
      .map(m => ({ title: m.track.title, views: m.video.views })),
  }
}

module.exports = { linkArtistDiscography, linkAlbum, isLinking }
