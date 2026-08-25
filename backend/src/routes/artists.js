const express = require('express')
const router = express.Router()
const mb = require('../services/musicbrainz')
const spotify = require('../services/spotifyService')
const wiki = require('../services/wikipediaService')
const db = require('../services/supabaseService')
const ytLinker = require('../services/youtubeLinker')
const { requireEditor } = require('../middleware/requireEditor')

const ingestingNow = new Set()
const ingestFailed = new Set()

// Artistas sin artículo en Wikipedia. Sin esto, cada visita vuelve a consultar
// y suma ~1s a la respuesta: el enriquecimiento corre antes de responder.
// Se pierde al reiniciar, que es justo lo que se quiere para reintentar cuando
// Wikipedia sume el artículo.
const bioNotFound = new Set()
const ingestAttempts = new Map()
const MAX_INGEST_ATTEMPTS = 2

async function ingestAlbumsInBackground(artist) {
  if (ingestingNow.has(artist.id)) return
  if (ingestFailed.has(artist.id)) return
  ingestingNow.add(artist.id)
  try {
    let spotifyId = artist.external_spotify_id
    if (!spotifyId) {
      const spotifyArtist = await spotify.searchArtist(artist.name)
      if (!spotifyArtist) {
        console.log(`[ingest] ${artist.name}: no encontrado en Spotify`)
        const attempts = (ingestAttempts.get(artist.id) || 0) + 1
        ingestAttempts.set(artist.id, attempts)
        if (attempts >= MAX_INGEST_ATTEMPTS) ingestFailed.add(artist.id)
        return
      }
      spotifyId = spotifyArtist.id
      const imageUrl = spotifyArtist.images?.[0]?.url || null
      await db.updateArtistSpotifyId(artist.id, spotifyId, imageUrl)
    }

    const albums = await spotify.getArtistAlbums(spotifyId)
    let saved = 0
    let firstError = null
    for (const album of albums) {
      try {
        await db.saveAlbum(album, artist.id)
        saved++
      } catch (err) {
        if (!firstError) firstError = err
      }
    }
    console.log(`[ingest] ${artist.name}: ${saved}/${albums.length} saved`)
    if (firstError) console.error('[ingest error]', firstError.message)
  } catch (err) {
    console.error('[ingest albums]', artist.name, err.message)
    ingestFailed.add(artist.id)
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

    // Imagen y bio: buscar inline si faltan (calls rápidos, solo 1 vez)
    const needsImage = Boolean(!artist.image_url && artist.external_spotify_id)
    const needsBio = !artist.bio && !bioNotFound.has(artist.id)
    console.log(`[artist enrich] ${artist.name}: needsImage=${needsImage} needsBio=${needsBio} bio=${artist.bio?.slice(0,30) ?? 'null'}`)

    const [imageResult, bioResult] = await Promise.allSettled([
      needsImage
        ? spotify.getArtistById(artist.external_spotify_id)
            .then(d => d?.images?.[0]?.url || null)
        : Promise.resolve(null),
      needsBio
        ? wiki.getArtistBio(artist.name)
        : Promise.resolve(null),
    ])

    if (needsImage && imageResult.status === 'fulfilled' && imageResult.value) {
      await db.updateArtistSpotifyId(artist.id, artist.external_spotify_id, imageResult.value)
      artist = { ...artist, image_url: imageResult.value }
    }
    if (needsBio && bioResult.status === 'fulfilled' && bioResult.value) {
      await db.saveBio(artist.id, bioResult.value)
      artist = { ...artist, bio: bioResult.value }
    } else if (needsBio) {
      bioNotFound.add(artist.id)
    }

    const albums = await db.getAlbumsByArtist(artist.id)

    const stillIngesting = ingestingNow.has(artist.id)
    const failed = ingestFailed.has(artist.id)

    // Responder inmediatamente con lo que hay en DB
    res.json({ artist, albums, ingestingAlbums: (albums.length === 0 && !failed) || stillIngesting })

    // Si no hay álbumes todavía, ingestar en background sin bloquear
    if (albums.length === 0 && artist.external_mb_id) {
      ingestAlbumsInBackground(artist)
    }

  } catch (err) {
    next(err)
  }
})

/**
 * Vincula toda la discografía con YouTube Music en una sola bajada del catálogo
 * del canal, que es lo mismo que cuesta vincular un disco suelto.
 *
 * No se dispara al entrar a la página del artista: esa ruta es pública y la
 * cuota de YouTube es un recurso agotable, así que la gasta un editor a
 * propósito y no el tráfico anónimo.
 */
router.post('/:id/youtube', requireEditor, async (req, res, next) => {
  try {
    const artist = await db.getArtistById(req.params.id)
    if (!artist) return res.status(404).json({ error: 'Artista no encontrado' })

    res.json(await ytLinker.linkArtistDiscography(artist, { auto: false }))
  } catch (err) {
    if (err.status === 429) return res.status(429).json({ error: err.message })
    next(err)
  }
})

/**
 * Vuelve a traer los metadatos de los discos desde Spotify.
 *
 * La ingesta automática sólo corre cuando el artista no tiene ningún álbum, así
 * que los discos ya cargados nunca se actualizan: los que entraron antes de que
 * existiera `release_date_precision`, por ejemplo, quedaron con la columna vacía.
 *
 * `saveAlbum` respeta `manual_fields`, así que las correcciones del admin
 * sobreviven al refresco.
 */
router.post('/:id/refresh-spotify', requireEditor, async (req, res, next) => {
  try {
    const artist = await db.getArtistById(req.params.id)
    if (!artist) return res.status(404).json({ error: 'Artista no encontrado' })

    let spotifyId = artist.external_spotify_id
    if (!spotifyId) {
      const found = await spotify.searchArtist(artist.name)
      if (!found) return res.status(404).json({ error: 'No se encontró el artista en Spotify' })
      spotifyId = found.id
      await db.updateArtistSpotifyId(artist.id, spotifyId, found.images?.[0]?.url || null)
    }

    const albums = await spotify.getArtistAlbums(spotifyId)
    let saved = 0
    const errors = []

    for (const album of albums) {
      try {
        await db.saveAlbum(album, artist.id)
        saved++
      } catch (err) {
        errors.push(`${album.name}: ${err.message}`)
      }
    }

    console.log(`[refresh spotify] ${artist.name}: ${saved}/${albums.length} álbumes actualizados`)
    res.json({ total: albums.length, saved, errors: errors.slice(0, 5) })
  } catch (err) {
    next(err)
  }
})

/**
 * Trae la formación de la banda desde MusicBrainz.
 *
 * No corre sola al entrar al artista: MusicBrainz limita a un pedido por
 * segundo para toda la app, así que gastarlo en cada visita pública dejaría sin
 * margen a la búsqueda, que es lo que sí necesita responder rápido.
 *
 * Es repetible: actualiza las etapas que ya estaban en vez de duplicarlas.
 */
router.post('/:id/members', requireEditor, async (req, res, next) => {
  try {
    const artist = await db.getArtistById(req.params.id)
    if (!artist) return res.status(404).json({ error: 'Artista no encontrado' })
    if (!artist.external_mb_id) {
      return res.status(400).json({ error: 'Este artista no está vinculado a MusicBrainz' })
    }

    // Las dos lecturas del mismo pedido: una banda trae sus integrantes, un
    // solista trae las bandas por las que pasó. No hay que saber de antemano
    // cuál es cuál, y un artista que sea las dos cosas se resuelve igual.
    const { members, bands } = await mb.getMemberRelations(artist.external_mb_id)
    const stages = [...members, ...bands]

    if (stages.length === 0) {
      return res.json({ total: 0, saved: 0, linked: 0, skipped: 0, people: 0 })
    }

    const { saved, linked, skipped } = await db.saveMembers(stages)
    const people = new Set(stages.map(s => s.person_mb_id)).size

    console.log(
      `[members] ${artist.name}: ${saved} etapas guardadas, ${people} músicos, ` +
      `${linked} con ficha, ${skipped} salteadas por banda fuera del catálogo`
    )
    res.json({ total: stages.length, saved, linked, skipped, people })
  } catch (err) {
    next(err)
  }
})

module.exports = router
