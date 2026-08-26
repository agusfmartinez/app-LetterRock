const express = require('express')
const router = express.Router()
const mb = require('../services/musicbrainz')
const db = require('../services/supabaseService')

router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query
    if (!q || !q.trim()) {
      return res.json({ artists: [], albums: [], tracks: [] })
    }

    const query = q.trim()

    // DB first — fast path
    const dbResults = await db.searchInDatabase(query)
    if (dbResults.length > 0) {
      return res.json({ artists: dbResults, albums: [], tracks: [], source: 'db' })
    }

    // MusicBrainz fallback — solo buscar, NO guardar (se guarda al entrar al artista)
    const { artists: mbArtists, wasFiltered } = await mb.searchArtist(query)

    if (wasFiltered) {
      return res.json({ artists: [], albums: [], tracks: [], source: 'musicbrainz', message: 'Próximamente...' })
    }

    // Un artista oculto por el admin no vuelve a aparecer, aunque MusicBrainz
    // lo siga devolviendo.
    const hidden = await db.getHiddenMbIds()

    const artists = mbArtists
      .filter(a => !hidden.has(a.id))
      .map(a => ({
        external_mb_id: a.id,
        name: a.name,
        slug: slugify(a.name),
        country: a.country || null,
        // Sin el tipo, la tarjeta trata a un solista como banda y le pone
        // "Formado en" a su año de nacimiento.
        artist_type: mb.normalizeArtistType(a.type),
        formed_year: a['life-span']?.begin
          ? parseInt(a['life-span'].begin.substring(0, 4), 10)
          : null,
      }))

    res.json({ artists, albums: [], tracks: [], source: 'musicbrainz' })
  } catch (err) {
    next(err)
  }
})

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

module.exports = router
