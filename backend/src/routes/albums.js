const express = require('express')
const router = express.Router()
const db = require('../services/supabaseService')
const spotify = require('../services/spotifyService')
const youtube = require('../services/youtubeService')
const linker = require('../services/youtubeLinker')
const { requireEditor } = require('../middleware/requireEditor')

const ingestingTracks = new Set()
const ingestTracksFailed = new Set()

async function ingestTracksInBackground(album) {
  if (ingestingTracks.has(album.id)) return
  if (ingestTracksFailed.has(album.id)) return
  if (!album.external_spotify_id) return
  ingestingTracks.add(album.id)
  try {
    const tracks = await spotify.getAlbumTracks(album.external_spotify_id)
    await db.saveTracks(tracks, album.id)
    console.log(`[ingest tracks] ${album.title}: ${tracks.length} saved`)
  } catch (err) {
    console.error('[ingest tracks]', album.title, err.message)
    ingestTracksFailed.add(album.id)
  } finally {
    ingestingTracks.delete(album.id)
  }
}

/** Adosa a cada track sus links de plataformas y las reproducciones conocidas. */
async function withMediaLinks(tracks) {
  if (!tracks.length) return tracks
  const links = await db.getMediaLinks('track', tracks.map(t => t.id))

  const byTrack = new Map()
  for (const link of links) {
    if (!byTrack.has(link.entity_id)) byTrack.set(link.entity_id, {})
    byTrack.get(link.entity_id)[link.provider] = link
  }

  return tracks.map(t => {
    const providers = byTrack.get(t.id) || {}
    return {
      ...t,
      links: providers,
      view_count: providers.youtube?.play_count ?? null,
    }
  })
}

router.get('/:id', async (req, res, next) => {
  try {
    const album = await db.getAlbumById(req.params.id)
    if (!album) return res.status(404).json({ error: 'Álbum no encontrado' })

    const [rawTracks, artist, albumLinks] = await Promise.all([
      db.getTracksByAlbum(album.id),
      db.getArtistById(album.artist_id),
      db.getMediaLinks('album', [album.id]),
    ])

    const tracks = await withMediaLinks(rawTracks)
    const links = Object.fromEntries(albumLinks.map(l => [l.provider, l]))

    // `ingestingTracks` hace que el front consulte cada segundo esperando el
    // tracklist. Sólo vale decir que sí cuando la ingesta puede llegar a traer
    // algo: un disco cargado a mano no tiene id de Spotify y nunca va a tener
    // tracks por esa vía, así que sin este chequeo el front quedaba consultando
    // para siempre.
    const canIngest = Boolean(album.external_spotify_id) && !ingestTracksFailed.has(album.id)
    const pending = rawTracks.length === 0 && canIngest

    res.json({
      album,
      tracks,
      artist: artist || null,
      links,
      ingestingTracks: pending,
    })

    if (pending) {
      ingestTracksInBackground(album)
    }
  } catch (err) {
    next(err)
  }
})

/**
 * Vincula un álbum con YouTube Music desde el editor.
 * Normalmente ya está hecho: la página del artista lo dispara sola.
 */
router.post('/:id/youtube', requireEditor, async (req, res, next) => {
  try {
    const album = await db.getAlbumById(req.params.id)
    if (!album) return res.status(404).json({ error: 'Álbum no encontrado' })

    const artist = await db.getArtistById(album.artist_id)
    if (!artist) return res.status(404).json({ error: 'Artista no encontrado' })

    res.json(await linker.linkAlbum(album, artist))
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        error: err.message,
        ...(err.availableAlbums && { availableAlbums: err.availableAlbums }),
      })
    }
    next(err)
  }
})

/**
 * Refresca sólo las reproducciones de los temas ya vinculados.
 * Cuesta 1 unidad cada 50 temas: se puede correr seguido.
 */
router.post('/:id/youtube/refresh', requireEditor, async (req, res, next) => {
  try {
    const tracks = await db.getTracksByAlbum(req.params.id)
    if (!tracks.length) return res.json({ updated: 0 })

    const links = (await db.getMediaLinks('track', tracks.map(t => t.id)))
      .filter(l => l.provider === 'youtube')

    if (!links.length) {
      return res.status(409).json({ error: 'El álbum no está vinculado a YouTube todavía' })
    }

    const stats = await youtube.getVideoStats(links.map(l => l.external_id))
    const now = new Date().toISOString()

    await db.saveMediaLinks(links.map(l => ({
      entity_type: l.entity_type,
      entity_id: l.entity_id,
      provider: l.provider,
      external_id: l.external_id,
      url: l.url,
      play_count: stats.get(l.external_id) ?? l.play_count,
      play_count_updated_at: now,
    })))

    res.json({ updated: links.length })
  } catch (err) {
    if (err.status === 429) return res.status(429).json({ error: err.message })
    next(err)
  }
})

module.exports = router
