const express = require('express')
const router = express.Router()
const mb = require('../services/musicbrainz')
const spotify = require('../services/spotifyService')
const wiki = require('../services/wikipediaService')
const db = require('../services/supabaseService')

const ingestingNow = new Set()
const ingestFailed = new Set()
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
    const needsImage = !artist.image_url && artist.external_spotify_id
    const needsBio = !artist.bio
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

module.exports = router
