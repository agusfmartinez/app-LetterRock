const { createClient } = require('@supabase/supabase-js')
const slugify = require('slugify')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

function makeSlug(name) {
  return slugify(name, { lower: true, strict: true })
}

function dbLog(label) {
  console.log(`[DB] ${new Date().toISOString()} ${label}`)
}

async function searchInDatabase(query) {
  dbLog(`searchInDatabase query="${query}"`)
  const { data } = await supabase
    .from('artists')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(20)
  return data || []
}

async function saveArtist(mbArtist) {
  dbLog(`saveArtist name="${mbArtist.name}"`)

  const slug = makeSlug(mbArtist.name)
  const payload = {
    external_mb_id: mbArtist.id,
    name: mbArtist.name,
    slug,
    country: mbArtist.country || null,
    formed_year: mbArtist['life-span']?.begin
      ? parseInt(mbArtist['life-span'].begin.substring(0, 4), 10)
      : null,
  }
  const { data, error } = await supabase
    .from('artists')
    .upsert(payload, { onConflict: 'external_mb_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

function normalizeSpotifyDate(raw, precision) {
  if (!raw) return null
  if (precision === 'year') return `${raw}-01-01`
  if (precision === 'month') return `${raw}-01`
  return raw
}

async function saveAlbum(spotifyAlbum, artistId) {
  dbLog(`saveAlbum title="${spotifyAlbum.name}"`)

  const slug = makeSlug(spotifyAlbum.name)
  const coverUrl = spotifyAlbum.images?.[0]?.url || null
  const payload = {
    artist_id: artistId,
    external_spotify_id: spotifyAlbum.id,
    title: spotifyAlbum.name,
    slug,
    release_date: normalizeSpotifyDate(spotifyAlbum.release_date, spotifyAlbum.release_date_precision),
    album_type: spotifyAlbum.album_type,
    cover_url: coverUrl,
  }
  const { data, error } = await supabase
    .from('albums')
    .upsert(payload, { onConflict: 'external_spotify_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

async function updateArtistSpotifyId(artistId, spotifyId) {
  dbLog(`updateArtistSpotifyId artistId="${artistId}"`)
  const { error } = await supabase
    .from('artists')
    .update({ external_spotify_id: spotifyId })
    .eq('id', artistId)
  if (error) throw error
}

async function saveTracks(tracks, albumId) {
  if (!tracks || !tracks.length) return []
  const payload = tracks.map((t, i) => ({
    album_id: albumId,
    external_mb_recording_id: t.id,
    title: t.title,
    duration_ms: t.length || null,
    track_number: t.position || i + 1,
    disc_number: 1,
  }))
  const { data, error } = await supabase
    .from('tracks')
    .upsert(payload, { onConflict: 'external_mb_recording_id' })
    .select()
  if (error) throw error
  return data || []
}

async function getArtistBySlug(slug) {
  dbLog(`getArtistBySlug slug="${slug}"`)

  const { data } = await supabase.from('artists').select('*').eq('slug', slug).single()
  return data
}

async function getArtistByMbId(mbId) {
  dbLog(`getArtistByMbId mbId="${mbId}"`)

  const { data } = await supabase.from('artists').select('*').eq('external_mb_id', mbId).single()
  return data
}

async function getAlbumsByArtist(artistId) {
  dbLog(`getAlbumsByArtist artistId="${artistId}"`)

  const { data } = await supabase
    .from('albums')
    .select('*')
    .eq('artist_id', artistId)
    .order('release_date', { ascending: true })
  return data || []
}

async function getAlbumById(id) {
  const { data } = await supabase.from('albums').select('*').eq('id', id).single()
  return data
}

async function getTracksByAlbum(albumId) {
  const { data } = await supabase
    .from('tracks')
    .select('*')
    .eq('album_id', albumId)
    .order('track_number', { ascending: true })
  return data || []
}

async function getTrackById(id) {
  const { data } = await supabase.from('tracks').select('*').eq('id', id).single()
  return data
}

module.exports = {
  searchInDatabase,
  saveArtist,
  saveAlbum,
  updateArtistSpotifyId,
  saveTracks,
  getArtistBySlug,
  getArtistByMbId,
  getAlbumsByArtist,
  getAlbumById,
  getTracksByAlbum,
  getTrackById,
}
