const axios = require('axios')

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const BASE_URL = 'https://api.spotify.com/v1'

let cachedToken = null
let tokenExpiresAt = 0

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64')

  const { data } = await axios.post(
    TOKEN_URL,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )

  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

async function spotifyRequest(path, params) {
  const token = await getToken()
  console.log(`[Spotify] ${new Date().toISOString()} ${path}`, params || '')
  try {
    const { data } = await axios.get(`${BASE_URL}${path}`, {
      ...(params && { params }),
      headers: { Authorization: `Bearer ${token}` },
    })
    return data
  } catch (err) {
    if (err.response) {
      console.error(`[Spotify error] ${err.response.status}`, JSON.stringify(err.response.data))
    }
    throw err
  }
}

/** Sin tildes ni mayúsculas: "Fito Páez" y "Fito Paez" son el mismo artista. */
function normalizeName(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/**
 * El artista en Spotify, entre varios perfiles con el mismo nombre.
 *
 * Spotify tiene duplicados vacíos: "Fito Páez" devuelve cinco perfiles, tres
 * con cero discos y cero imágenes, y el bueno está escrito sin tilde. Quedarse
 * con el primero de nombre exacto elegía uno muerto, y el artista entraba al
 * catálogo sin discografía.
 *
 * Los que no tienen imagen se descartan: un perfil real siempre tiene foto. Si
 * queda más de uno se cuentan los discos, que es lo único que distingue al
 * verdadero de un homónimo vacío. Son pocos pedidos y sólo la primera vez.
 */
async function searchArtist(name) {
  const data = await spotifyRequest('/search', {
    q: `artist:"${name}"`,
    type: 'artist',
    limit: 5,
  })

  const artists = data.artists?.items || []
  if (artists.length === 0) return null

  const wanted = normalizeName(name)
  const sameName = artists.filter(a => normalizeName(a.name) === wanted)
  const candidates = (sameName.length > 0 ? sameName : artists).filter(a => a.images?.length > 0)

  if (candidates.length === 0) return sameName[0] || artists[0]
  if (candidates.length === 1) return candidates[0]

  const counted = []
  for (const candidate of candidates.slice(0, 3)) {
    const albums = await getArtistAlbums(candidate.id)
    counted.push({ candidate, albums: albums.length })
  }
  counted.sort((a, b) => b.albums - a.albums)

  console.log(
    `[Spotify] "${name}": ${artists.length} perfiles, elegido ${counted[0].candidate.id} ` +
    `con ${counted[0].albums} discos`
  )
  return counted[0].candidate
}

async function getArtistAlbums(spotifyArtistId) {
  const albums = []
  let url = `/artists/${spotifyArtistId}/albums?include_groups=album,single&limit=10`

  while (url) {
    const data = await spotifyRequest(url)
    albums.push(...(data.items || []))
    url = data.next ? data.next.replace(BASE_URL, '') : null
  }

  return albums
}

async function getArtistById(spotifyArtistId) {
  return spotifyRequest(`/artists/${spotifyArtistId}`)
}

async function getAlbumTracks(spotifyAlbumId) {
  const tracks = []
  let url = `/albums/${spotifyAlbumId}/tracks?limit=50`

  while (url) {
    const data = await spotifyRequest(url)
    tracks.push(...(data.items || []))
    url = data.next ? data.next.replace(BASE_URL, '') : null
  }

  return tracks
}

module.exports = { searchArtist, getArtistById, getArtistAlbums, getAlbumTracks }
