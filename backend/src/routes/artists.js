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

  // La marca de refresco dice "se consultó a Spotify", no "se trajo algo": que
  // allá no haya discos es un resultado, y sin marcarlo el panel sigue diciendo
  // "nunca importado" después de haber corrido la ingesta. Va en `finally` para
  // que valga por cualquiera de las tres salidas, y se pone recién cuando
  // Spotify contestó: si el pedido falla no se consultó nada.
  let consulted = false
  try {
    let spotifyId = artist.external_spotify_id
    if (!spotifyId) {
      const spotifyArtist = await spotify.searchArtist(artist.name)
      consulted = true
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
    consulted = true

    // Spotify puede tener al artista pero sin un solo disco. La página del
    // artista se refresca sola mientras crea que la ingesta sigue corriendo, y
    // sin marcarlo se queda pidiendo cada dos segundos para siempre.
    if (albums.length === 0) {
      console.log(`[ingest] ${artist.name}: Spotify no tiene discos de este artista`)
      const attempts = (ingestAttempts.get(artist.id) || 0) + 1
      ingestAttempts.set(artist.id, attempts)
      if (attempts >= MAX_INGEST_ATTEMPTS) ingestFailed.add(artist.id)
      return
    }

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
    if (consulted) {
      try {
        await db.markArtistRun(artist.id, 'spotify')
      } catch (err) {
        // Que falle la marca no invalida los discos que ya se guardaron.
        console.error('[ingest] marca de refresco', artist.name, err.message)
      }
    }
  }
}

/**
 * Candidatos para poblar el catálogo: artistas de AR/UY con tag de rock
 * formados dentro de un período.
 *
 * Va antes que `/:slugOrMbId` a propósito: esa ruta matchea cualquier cosa y se
 * quedaría con "discover".
 *
 * Los resultados se guardan en memoria para que el alta no tenga que volver a
 * preguntarle a MusicBrainz por cada artista elegido —serían treinta pedidos a
 * uno por segundo— y para no confiar en datos que mande el cliente.
 */
const discovered = new Map()
const DISCOVER_TTL_MS = 20 * 60 * 1000

function rememberCandidates(artists) {
  const expiresAt = Date.now() + DISCOVER_TTL_MS
  for (const artist of artists) discovered.set(artist.id, { artist, expiresAt })

  for (const [id, entry] of discovered) {
    if (entry.expiresAt < Date.now()) discovered.delete(id)
  }
}

router.get('/discover', requireEditor, async (req, res, next) => {
  try {
    const artistName = (req.query.artist || '').trim()
    const albumTitle = (req.query.album || '').trim()
    const from = parseInt(req.query.from, 10)
    const to = parseInt(req.query.to, 10)
    const offset = parseInt(req.query.offset, 10) || 0

    const hasRange = Number.isFinite(from) && Number.isFinite(to)
    if ((req.query.from || req.query.to) && !hasRange) {
      return res.status(400).json({ error: 'Completá los dos años del rango' })
    }
    if (hasRange && from > to) {
      return res.status(400).json({ error: 'El año inicial es mayor que el final' })
    }
    if (!artistName && !albumTitle && !hasRange) {
      return res.status(400).json({ error: 'Completá al menos un campo' })
    }

    // Buscar por disco es otra consulta: el título vive en release-group, no en
    // el artista. Devuelve a quién pertenece cada disco que matcheó.
    const search = albumTitle
      ? await mb.findArtistsByAlbum({
          album: albumTitle,
          artist: artistName || null,
          from: hasRange ? from : null,
          to: hasRange ? to : null,
        })
      : await mb.discoverArtists({
          artist: artistName || null,
          from: hasRange ? from : null,
          to: hasRange ? to : null,
          offset,
        })

    const { artists, total, received, filtered, albumByArtist } = search
    rememberCandidates(artists)

    // Marcar los que ya están: el editor tiene que ver de un vistazo qué le
    // falta, no una lista donde la mitad ya la cargó.
    const known = await db.getArtistsByMbIds(artists.map(a => a.id))

    const nextOffset = offset + received

    res.json({
      total,
      filtered,
      offset,
      // Dónde sigue la próxima página y si queda algo. El cliente no puede
      // deducirlo de los artistas que recibe: el filtro de género ya los
      // recortó. La búsqueda por disco no pagina: son pocos y ya vienen
      // ordenados por relevancia.
      nextOffset,
      hasMore: !albumTitle && nextOffset < total,
      artists: artists.map(a => {
        const existing = known.get(a.id)
        return {
          mbId: a.id,
          name: a.name,
          type: mb.normalizeArtistType(a.type),
          country: a.country || a.area?.name || null,
          beginYear: a['life-span']?.begin
            ? parseInt(a['life-span'].begin.substring(0, 4), 10)
            : null,
          endYear: a['life-span']?.end
            ? parseInt(a['life-span'].end.substring(0, 4), 10)
            : null,
          tags: (a.tags || []).map(t => t.name).slice(0, 4),
          matchedAlbum: albumByArtist?.get(a.id) || null,
          inCatalog: Boolean(existing),
          hidden: Boolean(existing?.hidden),
          slug: existing?.slug || null,
        }
      }),
    })
  } catch (err) {
    if (err.status === 503) return res.status(503).json({ error: err.message })
    next(err)
  }
})

/**
 * Guarda los artistas elegidos y les trae los discos de Spotify.
 *
 * La ingesta corre en segundo plano y de a uno: son varios artistas por vez y
 * dispararlas todas juntas contra Spotify no acelera nada. La respuesta vuelve
 * apenas están los artistas, que es lo que el editor necesita ver.
 */
router.post('/discover', requireEditor, async (req, res, next) => {
  try {
    const mbIds = Array.isArray(req.body?.mbIds) ? req.body.mbIds : []
    if (mbIds.length === 0) {
      return res.status(400).json({ error: 'No seleccionaste ningún artista' })
    }

    const saved = []
    const missing = []

    for (const mbId of mbIds) {
      const entry = discovered.get(mbId)
      if (!entry) {
        missing.push(mbId)
        continue
      }
      saved.push(await db.saveArtist(entry.artist))
    }

    console.log(`[discover] ${saved.length} artistas guardados, ${missing.length} vencidos`)
    res.json({
      saved: saved.length,
      expired: missing.length,
      artists: saved.map(a => ({ id: a.id, name: a.name, slug: a.slug })),
    })

    // Después de responder: los discos tardan y nadie está esperándolos.
    ;(async () => {
      for (const artist of saved) {
        await ingestAlbumsInBackground(artist)
      }
      console.log(`[discover] ingesta de discos terminada para ${saved.length} artistas`)
    })()
  } catch (err) {
    next(err)
  }
})

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

    const result = await ytLinker.linkArtistDiscography(artist, { auto: false })
    // Sólo si encontró el canal: sin eso no vinculó nada y marcarlo haría creer
    // que el artista ya está resuelto.
    if (!result.skipped) await db.markArtistRun(artist.id, 'youtube')
    res.json(result)
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

    let albums = await spotify.getArtistAlbums(spotifyId)

    // El id guardado puede apuntar a un perfil vacío: Spotify tiene duplicados
    // sin discos y las ingestas viejas se quedaban con el primero que matcheara
    // el nombre. Si no devuelve nada, vale la pena buscar de nuevo antes de
    // decir que el artista no tiene discografía.
    if (albums.length === 0) {
      const found = await spotify.searchArtist(artist.name)
      if (found && found.id !== spotifyId) {
        const better = await spotify.getArtistAlbums(found.id)
        if (better.length > 0) {
          console.log(`[refresh spotify] ${artist.name}: perfil corregido ${spotifyId} → ${found.id}`)
          spotifyId = found.id
          albums = better
          await db.updateArtistSpotifyId(artist.id, spotifyId, found.images?.[0]?.url || null)
        }
      }
    }
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

    await db.markArtistRun(artist.id, 'spotify')
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
    const { artistType, members, bands } = await mb.getMemberRelations(artist.external_mb_id)
    const stages = [...members, ...bands]

    // Aprovecha el mismo pedido para completar banda/músico en los artistas que
    // se cargaron antes de que la columna existiera.
    const typeSaved = await db.saveArtistType(artist.id, artistType)

    // La marca dice "se consultó a MusicBrainz", no "se encontró algo": que no
    // haya relaciones cargadas allá es un resultado, y sin marcarlo el panel
    // seguiría diciendo "nunca importado" después de haberlo intentado.
    await db.markArtistRun(artist.id, 'members')

    if (stages.length === 0) {
      return res.json({ total: 0, saved: 0, linked: 0, skipped: 0, people: 0, artistType: typeSaved ? artistType : null })
    }

    const { saved, linked, skipped } = await db.saveMembers(stages)
    const people = new Set(stages.map(s => s.person_mb_id)).size

    console.log(
      `[members] ${artist.name}: ${saved} etapas guardadas, ${people} músicos, ` +
      `${linked} con ficha, ${skipped} salteadas por banda fuera del catálogo`
    )
    res.json({ total: stages.length, saved, linked, skipped, people, artistType: typeSaved ? artistType : null })
  } catch (err) {
    // MusicBrainz caído o lento no es un error de la app: el editor tiene que
    // leer "probá de nuevo", no un 500 sin explicación.
    if (err.status === 503) return res.status(503).json({ error: err.message })
    next(err)
  }
})

module.exports = router
