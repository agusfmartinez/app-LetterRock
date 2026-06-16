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

async function searchArtist(name) {
  const data = await spotifyRequest('/search', {
    q: `artist:"${name}"`,
    type: 'artist',
    limit: 5,
  })
  const artists = data.artists?.items || []
  // Primer resultado con nombre exacto (case-insensitive)
  const exact = artists.find(a => a.name.toLowerCase() === name.toLowerCase())
  return exact || artists[0] || null
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
