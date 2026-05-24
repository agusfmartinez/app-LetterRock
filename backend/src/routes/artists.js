const express = require('express')
const router = express.Router()
const mb = require('../services/musicbrainz')
const db = require('../services/supabaseService')

const ingestingNow = new Set()

async function ingestAlbumsInBackground(artist) {
  if (ingestingNow.has(artist.id)) return
  ingestingNow.add(artist.id)
  try {
    const releaseGroups = await mb.getArtistReleaseGroups(artist.external_mb_id)
    let saved = 0
    let firstError = null
    for (const rg of releaseGroups.slice(0, 100)) {
      try {
        await db.saveAlbum(rg, artist.id)
        saved++
      } catch (err) {
        if (!firstError) firstError = err
      }
    }
    console.log(`[ingest] ${artist.name}: ${saved}/${releaseGroups.length} saved`)
    if (firstError) console.error('[ingest error]', firstError.message)
  } catch (err) {
    console.error('[ingest albums]', artist.name, err.message)
  } finally {
    ingestingNow.delete(artist.id)
  }
}

router.get('/:slugOrMbId', async (req, res, next) => {
  try {
    const { slugOrMbId } = req.params

    // Buscar en DB: primero por slug, luego por external_mb_id
    let artist = await db.getArtistBySlug(slugOrMbId)
    if (!artist) {
      artist = await db.getArtistByMbId(slugOrMbId)
    }

    // Si no está en DB pero parece MB UUID → fetchear de MB y guardar
    const mbUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!artist && mbUuidRegex.test(slugOrMbId)) {
      const mbData = await mb.getArtistById(slugOrMbId)
      if (!mbData) return res.status(404).json({ error: 'Artista no encontrado' })
      artist = await db.saveArtist(mbData)
    }

    if (!artist) {
      return res.status(404).json({ error: 'Artista no encontrado' })
    }

    const albums = await db.getAlbumsByArtist(artist.id)

    // Responder inmediatamente con lo que hay en DB
    res.json({ artist, albums, ingestingAlbums: albums.length === 0 })

    // Si no hay álbumes todavía, ingestar en background sin bloquear
    if (albums.length === 0 && artist.external_mb_id) {
      ingestAlbumsInBackground(artist)
    }
  } catch (err) {
    next(err)
  }
})

module.exports = router
