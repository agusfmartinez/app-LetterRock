const express = require('express')
const router = express.Router()
const mb = require('../services/musicbrainz')
const db = require('../services/supabaseService')

router.get('/:slugOrMbId', async (req, res, next) => {
  try {
    const { slugOrMbId } = req.params

    // Buscar en DB: primero por slug, luego por external_mb_id
    let artist = await db.getArtistBySlug(slugOrMbId)
    if (!artist) {
      artist = await db.getArtistByMbId(slugOrMbId)
    }

    // Si no está en DB pero el param parece un MB UUID → fetchear de MB y guardar
    const mbUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!artist && mbUuidRegex.test(slugOrMbId)) {
      const mbData = await mb.getArtistById(slugOrMbId)
      if (!mbData) return res.status(404).json({ error: 'Artista no encontrado' })
      artist = await db.saveArtist(mbData)
    }

    if (!artist) {
      return res.status(404).json({ error: 'Artista no encontrado' })
    }

    let albums = await db.getAlbumsByArtist(artist.id)

    // Lazy ingesta de discografía
    if (albums.length === 0 && artist.external_mb_id) {
      const releaseGroups = await mb.getArtistReleaseGroups(artist.external_mb_id)
      for (const rg of releaseGroups.slice(0, 50)) {
        try {
          await db.saveAlbum(rg, artist.id)
        } catch {
          // skip
        }
      }
      albums = await db.getAlbumsByArtist(artist.id)
    }

    res.json({ artist, albums })
  } catch (err) {
    next(err)
  }
})

module.exports = router
