const axios = require('axios')

const BASE_URL = 'https://www.googleapis.com/youtube/v3'

// Costo en unidades de cuota. El cupo gratuito es 10.000 por día.
const COST = { search: 100, list: 1 }

// La cuota se resetea a medianoche hora del Pacífico, que es cuando Google
// corta el día. Se lleva la cuenta en memoria: se pierde al reiniciar, pero
// alcanza para frenar un derroche dentro de una misma jornada.
const DAILY_BUDGET = Number(process.env.YOUTUBE_DAILY_BUDGET || 9000)
// Las corridas automáticas se detienen antes, para que siempre quede resto
// para lo que un editor dispare a mano.
const AUTO_BUDGET = Number(process.env.YOUTUBE_AUTO_BUDGET || 6000)

let spentToday = 0
let budgetDay = null

function currentDay() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

function rollOverIfNeeded() {
  const today = currentDay()
  if (budgetDay !== today) {
    budgetDay = today
    spentToday = 0
  }
}

/** ¿Alcanza el presupuesto para una operación de este costo? */
function hasBudgetFor(cost, { auto = false } = {}) {
  rollOverIfNeeded()
  const ceiling = auto ? AUTO_BUDGET : DAILY_BUDGET
  return spentToday + cost <= ceiling
}

function getQuotaState() {
  rollOverIfNeeded()
  return { spentToday, dailyBudget: DAILY_BUDGET, autoBudget: AUTO_BUDGET, day: budgetDay }
}

function ytLog(label, cost) {
  rollOverIfNeeded()
  spentToday += cost
  console.log(`[YouTube] ${new Date().toISOString()} ${label} (cuota +${cost}, hoy ${spentToday}/${DAILY_BUDGET})`)
}

async function ytRequest(path, params, cost) {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error('Falta YOUTUBE_API_KEY en el entorno')

  ytLog(path, cost)
  try {
    const { data } = await axios.get(`${BASE_URL}${path}`, {
      params: { ...params, key },
    })
    return data
  } catch (err) {
    const detail = err.response?.data?.error
    if (detail) {
      console.error(`[YouTube error] ${err.response.status}`, detail.message)
      if (detail.errors?.some(e => e.reason === 'quotaExceeded')) {
        const quotaError = new Error('Se agotó la cuota diaria de YouTube')
        quotaError.status = 429
        throw quotaError
      }
    }
    throw err
  }
}

/** Normaliza títulos para poder cruzar los temas de Spotify con los de YouTube. */
function normalizeTitle(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')          // acentos
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')     // (remastered 2011), [en vivo]
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Saca el álbum de la descripción auto-generada de YouTube, que tiene la forma:
 *
 *   Provided to YouTube by <distribuidora>
 *   (vacío)
 *   <Tema> · <Artista>
 *   (vacío)
 *   <Álbum>
 *
 * Es el único lugar donde YouTube dice a qué disco pertenece el video.
 */
function albumFromDescription(description) {
  const lines = String(description || '').split('\n')
  const creditsIndex = lines.findIndex(line => line.includes(' · '))
  if (creditsIndex === -1) return null

  for (let i = creditsIndex + 1; i < lines.length; i++) {
    const value = lines[i].trim()
    if (value) return value
  }
  return null
}

/**
 * Canal "- Topic" del artista.
 *
 * Es la única llamada cara (100 unidades) y se hace una vez por artista: el id
 * queda guardado en media_links y todos sus discos siguientes salen gratis.
 *
 * No se busca la playlist del álbum porque `search.list?type=playlist` sólo
 * devuelve playlists de usuarios; las auto-generadas de los discos no están
 * indexadas en la búsqueda.
 */
async function findArtistTopicChannel(artistName) {
  const data = await ytRequest('/search', {
    part: 'snippet',
    type: 'channel',
    q: `${artistName} topic`,
    maxResults: 10,
  }, COST.search)

  const items = data.items || []
  const wanted = normalizeTitle(artistName)

  const topic = items.find(item => normalizeTitle(item.snippet?.title) === `${wanted} topic`)
  if (topic) return { channelId: topic.id.channelId, title: topic.snippet.title, exact: true }

  const loose = items.find(item => {
    const title = normalizeTitle(item.snippet?.title)
    return title.endsWith(' topic') && title.includes(wanted)
  })
  if (loose) return { channelId: loose.id.channelId, title: loose.snippet.title, exact: false }

  return null
}

/**
 * Catálogo completo del canal: título, álbum y reproducciones de cada video.
 * Cuesta ~1 unidad cada 50 videos por lado, así que un artista entero sale por
 * unas 10 unidades una vez que se conoce el canal.
 */
async function getChannelCatalog(channelId) {
  const channel = await ytRequest('/channels', {
    part: 'contentDetails',
    id: channelId,
  }, COST.list)

  const uploads = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) return []

  const videoIds = []
  let pageToken = null
  do {
    const page = await ytRequest('/playlistItems', {
      part: 'contentDetails',
      playlistId: uploads,
      maxResults: 50,
      ...(pageToken && { pageToken }),
    }, COST.list)

    videoIds.push(...(page.items || []).map(i => i.contentDetails?.videoId).filter(Boolean))
    pageToken = page.nextPageToken || null
  } while (pageToken)

  const catalog = []
  for (let i = 0; i < videoIds.length; i += 50) {
    const data = await ytRequest('/videos', {
      part: 'snippet,statistics',
      id: videoIds.slice(i, i + 50).join(','),
    }, COST.list)

    for (const video of data.items || []) {
      catalog.push({
        videoId: video.id,
        title: video.snippet?.title,
        album: albumFromDescription(video.snippet?.description),
        views: video.statistics?.viewCount != null ? Number(video.statistics.viewCount) : null,
      })
    }
  }

  return catalog
}

/**
 * Cruza los temas del álbum con los videos del canal.
 *
 * Se filtra por álbum y no sólo por título porque el canal repite el mismo tema
 * en cada recopilación, y esas subidas tienen unos cientos de reproducciones
 * frente a los millones de la edición original. Sin ese filtro el ranking
 * quedaría armado con el ruido de los compilados.
 *
 * Si un tema aparece más de una vez dentro del mismo álbum, gana el de más
 * reproducciones.
 */
function matchAlbumTracks(tracks, catalog, albumTitle) {
  const wantedAlbum = normalizeTitle(albumTitle)

  const fromAlbum = catalog.filter(v => normalizeTitle(v.album) === wantedAlbum)
  if (fromAlbum.length === 0) return { matches: [], albumFound: false }

  const byTitle = new Map()
  for (const video of fromAlbum) {
    const key = normalizeTitle(video.title)
    const current = byTitle.get(key)
    if (!current || (video.views || 0) > (current.views || 0)) {
      byTitle.set(key, video)
    }
  }

  const matches = []
  const used = new Set()

  for (const track of tracks) {
    const key = normalizeTitle(track.title)
    const hit = byTitle.get(key)
    if (hit && !used.has(hit.videoId)) {
      used.add(hit.videoId)
      matches.push({ track, video: hit, matchedBy: 'title' })
    }
  }

  // Segunda pasada tolerante: títulos que uno de los dos lados recorta.
  for (const track of tracks) {
    if (matches.some(m => m.track.id === track.id)) continue
    const key = normalizeTitle(track.title)

    const candidate = fromAlbum
      .filter(v => !used.has(v.videoId))
      .find(v => {
        const videoKey = normalizeTitle(v.title)
        return videoKey.includes(key) || key.includes(videoKey)
      })

    if (candidate) {
      used.add(candidate.videoId)
      matches.push({ track, video: candidate, matchedBy: 'partial' })
    }
  }

  return { matches, albumFound: true }
}

/** Reproducciones por video. 1 unidad cada 50 ids: es la llamada barata de refrescar. */
async function getVideoStats(videoIds) {
  const stats = new Map()

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const data = await ytRequest('/videos', {
      part: 'statistics',
      id: batch.join(','),
    }, COST.list)

    for (const item of data.items || []) {
      const views = item.statistics?.viewCount
      stats.set(item.id, views != null ? Number(views) : null)
    }
  }

  return stats
}

/** Álbumes publicados por el canal. Sirve para explicar por qué no hubo match. */
function albumsInCatalog(catalog) {
  return [...new Set(catalog.map(v => v.album).filter(Boolean))]
}

module.exports = {
  COST,
  hasBudgetFor,
  getQuotaState,
  findArtistTopicChannel,
  getChannelCatalog,
  matchAlbumTracks,
  getVideoStats,
  albumsInCatalog,
  albumFromDescription,
  normalizeTitle,
}
