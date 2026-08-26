const axios = require('axios')
const { translateRole } = require('./roles')

const BASE_URL = 'https://musicbrainz.org/ws/2'
const USER_AGENT = process.env.MUSICBRAINZ_USER_AGENT || 'LetterRockApp/1.0 (contact@example.com)'

let lastRequestTime = 0

// MusicBrainz no es rápido con las consultas grandes: las relaciones de un
// artista con décadas de carrera pasan de diez segundos. Y cuando está cargado
// contesta 503 pidiendo que reintentes, no es un error definitivo.
const TIMEOUT_MS = 25000
const MAX_ATTEMPTS = 3

function isWorthRetrying(err) {
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return true
  const status = err.response?.status
  return status === 503 || status === 429 || status === 502 || status === 504
}

async function rateLimitedRequest(url, params = {}) {
  const shortUrl = url.replace(BASE_URL, '')
  let lastError

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // El límite de un pedido por segundo es de la API entera, así que la espera
    // va acá y no por reintento: dos llamadas seguidas de distinto origen
    // también tienen que separarse.
    const elapsed = Date.now() - lastRequestTime
    if (elapsed < 1100) {
      await new Promise(r => setTimeout(r, 1100 - elapsed))
    }
    lastRequestTime = Date.now()

    console.log(`[MB API] ${new Date().toISOString()} ${shortUrl} ${JSON.stringify(params)}`)
    try {
      const response = await axios.get(url, {
        params: { ...params, fmt: 'json' },
        headers: { 'User-Agent': USER_AGENT },
        timeout: TIMEOUT_MS,
      })
      return response.data
    } catch (err) {
      lastError = err
      if (attempt === MAX_ATTEMPTS || !isWorthRetrying(err)) break

      const waitMs = 2000 * attempt
      console.log(`[MB API] ${shortUrl} falló (${err.code || err.response?.status}), reintento ${attempt + 1} en ${waitMs}ms`)
      await new Promise(r => setTimeout(r, waitMs))
    }
  }

  if (isWorthRetrying(lastError)) {
    const err = new Error('MusicBrainz no respondió a tiempo. Probá de nuevo en un momento.')
    err.status = 503
    throw err
  }
  throw lastError
}

const BLOCKED_GENRES = new Set([
  'trap', 'reggaeton', 'cumbia', 'salsa', 'bachata', 'merengue',
  'tropical', 'techno', 'house', 'trance', 'edm', 'electrónica',
  'electronica', 'electronic', 'dubstep', 'hip hop', 'hip-hop',
  'rap', 'r&b', 'latin pop', 'pop', 'dance', 'k-pop',
])

const ALLOWED_COUNTRIES = new Set(['ar', 'uy'])

// Ciudades/regiones de AR y UY en MusicBrainz
const ALLOWED_AREAS = new Set([
  'argentina', 'uruguay',
  'buenos aires', 'córdoba', 'cordoba', 'rosario', 'mendoza',
  'la plata', 'mar del plata', 'salta', 'tucumán', 'tucuman',
  'santa fe', 'neuquén', 'neuquen', 'san juan', 'san luis',
  'entre ríos', 'entre rios', 'corrientes', 'misiones', 'chaco',
  'formosa', 'jujuy', 'catamarca', 'la rioja', 'río negro',
  'rio negro', 'chubut', 'santa cruz', 'tierra del fuego',
  'montevideo', 'salto', 'paysandú', 'paysandu', 'colonia',
])

function isFromRegion(artist) {
  const country = (artist.country || '').toLowerCase()
  if (ALLOWED_COUNTRIES.has(country)) return true
  const area = (artist.area?.name || artist['begin-area']?.name || '').toLowerCase()
  return ALLOWED_AREAS.has(area)
}

function isRockCandidate(artist) {
  const tags = artist.tags || []
  if (tags.length === 0) return true // sin tags → beneficio de la duda
  const tagNames = tags.map(t => t.name.toLowerCase())
  return !tagNames.some(t => BLOCKED_GENRES.has(t))
}

async function searchArtist(query) {
  const data = await rateLimitedRequest(`${BASE_URL}/artist`, {
    query: `artist:"${query}"`,
    limit: 25,
    inc: 'tags',
  })
  const all = data.artists || []
  const fromRegion = all.filter(isFromRegion)
  const artists = fromRegion.filter(isRockCandidate)
  // wasFiltered = había resultados de AR/UY pero todos bloqueados por género
  const wasFiltered = artists.length === 0 && fromRegion.length > 0
  return { artists, wasFiltered }
}

async function getArtistById(artistId) {
  const data = await rateLimitedRequest(`${BASE_URL}/artist/${artistId}`, {
    inc: 'tags',
  })
  return data || null
}

/**
 * "Group" | "Person" | "Orchestra" | "Choir" | "Character" | null → tres valores.
 *
 * Lo único que cambia en la app es qué muestra la ficha: una banda lista su
 * formación, una persona su trayectoria. Todo lo demás cae en 'other'.
 */
function normalizeArtistType(mbType) {
  const type = (mbType || '').toLowerCase()
  if (type === 'group' || type === 'orchestra' || type === 'choir') return 'group'
  if (type === 'person') return 'person'
  return type ? 'other' : null
}

// "original" marca la formación fundadora, no es un instrumento.
const ORIGINAL_ATTRIBUTE = 'original'

function yearOf(rawDate) {
  if (!rawDate) return null
  const year = parseInt(String(rawDate).substring(0, 4), 10)
  return Number.isFinite(year) ? year : null
}

/**
 * Junta las relaciones "member of band" en una etapa por músico.
 *
 * MusicBrainz manda una relación por instrumento: Charly García en Sui Generis
 * entre 1968 y 1975 aparece cuatro veces (voz, piano, guitarra, teclados). Sin
 * agrupar, la formación se leería como cuatro integrantes distintos.
 *
 * La clave es músico + tramo, no sólo músico: García también vuelve en 1981 y
 * en 2000, y esas son etapas separadas que hay que poder ver por separado.
 *
 * `direction` dice de qué lado se está mirando la misma relación. En la ficha
 * de una banda las relaciones vienen "backward" y el otro extremo es el músico;
 * en la de una persona vienen "forward" y el otro extremo es la banda. Sin
 * distinguirlas, importar un solista guardaría sus bandas como si fueran sus
 * integrantes.
 */
function collapseMemberRelations(relations, direction, selfMbId) {
  const stages = new Map()

  for (const rel of relations) {
    if (rel.type !== 'member of band') continue
    if (rel.direction !== direction) continue
    const other = rel.artist
    if (!other?.id) continue

    const personMbId = direction === 'backward' ? other.id : selfMbId
    const bandMbId = direction === 'backward' ? selfMbId : other.id

    // La clave nombra los dos extremos y el tramo, siempre en el mismo orden.
    //
    // Que estén los dos no es redundante: mirando la ficha de una persona el
    // músico es siempre el mismo, así que sin la banda dos etapas sin fecha
    // —Charly en Serú Girán y en La Máquina de Hacer Pájaros— colapsarían en
    // una y una de las dos se perdería.
    //
    // Y que el orden no dependa de qué ficha se esté mirando es lo que hace que
    // importar Sui Generis y después Charly García caiga en la misma fila en
    // vez de crear dos versiones de la misma etapa.
    const key = `${personMbId}:${bandMbId}:${rel.begin || ''}:${rel.end || ''}`

    const attributes = rel.attributes || []
    const roles = attributes
      .filter(a => a.toLowerCase() !== ORIGINAL_ATTRIBUTE)
      .map(translateRole)
    const isOriginal = attributes.some(a => a.toLowerCase() === ORIGINAL_ATTRIBUTE)

    const existing = stages.get(key)
    if (existing) {
      for (const role of roles) {
        if (!existing.roles.includes(role)) existing.roles.push(role)
      }
      existing.is_original = existing.is_original || isOriginal
      continue
    }

    stages.set(key, {
      mb_key: key,
      person_mb_id: personMbId,
      band_mb_id: bandMbId,
      other_name: other.name,
      roles,
      year_from: yearOf(rel.begin),
      year_to: yearOf(rel.end),
      is_original: isOriginal,
      ended: Boolean(rel.ended),
    })
  }

  // Sin año de entrada se ordena por el de salida, que es la única pista que
  // queda. Los que MusicBrainz no fechó de ningún lado van últimos: no se
  // pueden ubicar en la línea de tiempo.
  const anchor = (stage) => stage.year_from ?? stage.year_to ?? null

  return [...stages.values()].sort((a, b) => {
    const ay = anchor(a)
    const by = anchor(b)
    if (ay === by) return a.other_name.localeCompare(b.other_name)
    if (ay === null) return 1
    if (by === null) return -1
    return ay - by
  })
}

/**
 * Las dos lecturas de un mismo pedido: quiénes tocaron en esta banda y en qué
 * bandas tocó esta persona. Una ficha suele tener una sola de las dos, pero
 * separarlas cuesta lo mismo que traerlas juntas.
 */
async function getMemberRelations(artistId) {
  const data = await rateLimitedRequest(`${BASE_URL}/artist/${artistId}`, {
    inc: 'artist-rels',
  })
  const relations = data?.relations || []
  return {
    // Viene en la misma respuesta y decide si la ficha muestra "Formación" o
    // "Bandas", así que se aprovecha: los artistas cargados antes de que la
    // columna existiera lo tienen en NULL y no hay otro momento en que se les
    // vuelva a preguntar a MusicBrainz.
    artistType: normalizeArtistType(data?.type),
    members: collapseMemberRelations(relations, 'backward', artistId),
    bands: collapseMemberRelations(relations, 'forward', artistId),
  }
}

const ALLOWED_SECONDARY_TYPES = new Set(['', 'live'])
const BLOCKED_PRIMARY_TYPES = new Set(['single', 'broadcast', 'other'])

const DATE_TITLE_REGEX = /^\d{4}-\d{2}-\d{2}[\s:]/

function isAllowedReleaseGroup(rg) {
  const primary = (rg['primary-type'] || '').toLowerCase()
  if (BLOCKED_PRIMARY_TYPES.has(primary)) return false
  const secondary = (rg['secondary-types'] || []).map(s => s.toLowerCase())
  if (!secondary.every(s => ALLOWED_SECONDARY_TYPES.has(s))) return false
  // Bloquear grabaciones de conciertos nombradas por fecha (bootlegs)
  if (DATE_TITLE_REGEX.test(rg.title)) return false
  return true
}

async function getArtistReleaseGroups(artistId) {
  const data = await rateLimitedRequest(`${BASE_URL}/release-group`, {
    artist: artistId,
    limit: 100,
  })
  const all = data['release-groups'] || []
  return all.filter(isAllowedReleaseGroup)
}

async function getReleaseGroupReleases(releaseGroupId) {
  const data = await rateLimitedRequest(`${BASE_URL}/release`, {
    'release-group': releaseGroupId,
    limit: 10,
  })
  return data.releases || []
}

async function getFirstOfficialRelease(releaseGroupId) {
  const releases = await getReleaseGroupReleases(releaseGroupId)
  return releases.find(r => r.status === 'Official') || null
}

module.exports = {
  searchArtist,
  getArtistById,
  getArtistReleaseGroups,
  getReleaseGroupReleases,
  getFirstOfficialRelease,
  getMemberRelations,
  collapseMemberRelations,
  normalizeArtistType,
}
