const axios = require('axios')

const BASE_URL = 'https://musicbrainz.org/ws/2'
const USER_AGENT = process.env.MUSICBRAINZ_USER_AGENT || 'LetterRockApp/1.0 (contact@example.com)'

let lastRequestTime = 0

async function rateLimitedRequest(url, params = {}) {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < 1100) {
    await new Promise(r => setTimeout(r, 1100 - elapsed))
  }
  lastRequestTime = Date.now()

  const response = await axios.get(url, {
    params: { ...params, fmt: 'json' },
    headers: { 'User-Agent': USER_AGENT },
    timeout: 10000,
  })
  return response.data
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
    query: `artist:${query}`,
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

async function getArtistReleaseGroups(artistId) {
  const data = await rateLimitedRequest(`${BASE_URL}/release-group`, {
    artist: artistId,
    type: 'album|single|ep',
    limit: 100,
  })
  return data['release-groups'] || []
}

async function getReleaseGroupReleases(releaseGroupId) {
  const data = await rateLimitedRequest(`${BASE_URL}/release`, {
    'release-group': releaseGroupId,
    limit: 1,
    inc: 'recordings',
  })
  return data.releases || []
}

module.exports = { searchArtist, getArtistById, getArtistReleaseGroups, getReleaseGroupReleases }
