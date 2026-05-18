const express = require('express')
const router = express.Router()
const db = require('../services/supabaseService')

router.get('/:id', async (req, res, next) => {
  try {
    const track = await db.getTrackById(req.params.id)
    if (!track) return res.status(404).json({ error: 'Canción no encontrada' })
    res.json({ track, comments: [] })
  } catch (err) {
    next(err)
  }
})

module.exports = router
