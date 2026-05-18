const express = require('express')
const router = express.Router()
const db = require('../services/supabaseService')

router.get('/:id', async (req, res, next) => {
  try {
    const album = await db.getAlbumById(req.params.id)
    if (!album) return res.status(404).json({ error: 'Álbum no encontrado' })

    const tracks = await db.getTracksByAlbum(album.id)
    res.json({ album, tracks })
  } catch (err) {
    next(err)
  }
})

module.exports = router
