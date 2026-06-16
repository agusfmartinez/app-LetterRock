const express = require('express')
const router = express.Router()
const db = require('../services/supabaseService')
const spotify = require('../services/spotifyService')

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

router.get('/:id', async (req, res, next) => {
  try {
    const album = await db.getAlbumById(req.params.id)
    if (!album) return res.status(404).json({ error: 'Álbum no encontrado' })

    const tracks = await db.getTracksByAlbum(album.id)
    res.json({ album, tracks, ingestingTracks: tracks.length === 0 })

    if (tracks.length === 0) {
      ingestTracksInBackground(album)
    }
  } catch (err) {
    next(err)
  }
})

module.exports = router
