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

const SPOTIFY_BASE = {
  artist: 'https://open.spotify.com/artist/',
  album: 'https://open.spotify.com/album/',
  track: 'https://open.spotify.com/track/',
}

/**
 * Registra los links a plataformas. `external_spotify_id` sigue siendo la clave
 * de upsert de la ingesta; media_links es lo que lee la app, y es donde después
 * entran YouTube y las demás.
 */
async function saveMediaLinks(rows) {
  const clean = (rows || []).filter(r => r.entity_id && r.external_id)
  if (!clean.length) return
  dbLog(`saveMediaLinks count=${clean.length}`)
  const { error } = await supabase
    .from('media_links')
    .upsert(clean, { onConflict: 'entity_type,entity_id,provider' })
  if (error) throw error
}

function spotifyLinkRow(entityType, entityId, externalId) {
  return {
    entity_type: entityType,
    entity_id: entityId,
    provider: 'spotify',
    external_id: externalId,
    url: SPOTIFY_BASE[entityType] + externalId,
  }
}

async function searchInDatabase(query) {
  dbLog(`searchInDatabase query="${query}"`)
  const { data } = await supabase
    .from('artists')
    .select('*')
    .ilike('name', `%${query}%`)
    .eq('hidden', false)
    .limit(20)
  return data || []
}

/**
 * Saca del payload los campos que el admin corrigió a mano.
 *
 * La ingesta corre cada vez que alguien entra a un artista, así que sin esto
 * una fecha o un título arreglados desde el CRUD volverían al valor de Spotify
 * sin que nadie se entere.
 */
function stripManualFields(payload, manualFields) {
  if (!manualFields || manualFields.length === 0) return payload
  const clean = { ...payload }
  for (const field of manualFields) delete clean[field]
  return clean
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
    // Sin la precisión no se puede distinguir un disco del 1 de enero de uno
    // del que Spotify sólo sabe el año: ambos quedan como 'YYYY-01-01'.
    release_date_precision: spotifyAlbum.release_date_precision || null,
    album_type: spotifyAlbum.album_type,
    cover_url: coverUrl,
  }
  const { data: existing } = await supabase
    .from('albums')
    .select('manual_fields')
    .eq('external_spotify_id', spotifyAlbum.id)
    .maybeSingle()

  const protectedFields = existing?.manual_fields || []
  if (protectedFields.length) {
    dbLog(`saveAlbum respeta campos manuales: ${protectedFields.join(', ')}`)
  }

  const { data, error } = await supabase
    .from('albums')
    .upsert(stripManualFields(payload, protectedFields), { onConflict: 'external_spotify_id' })
    .select()
    .single()
  if (error) throw error

  await saveMediaLinks([spotifyLinkRow('album', data.id, spotifyAlbum.id)])
  return data
}

async function artistManualFields(artistId) {
  const { data } = await supabase
    .from('artists')
    .select('manual_fields')
    .eq('id', artistId)
    .maybeSingle()
  return data?.manual_fields || []
}

async function saveBio(artistId, bio) {
  dbLog(`saveBio artistId="${artistId}"`)
  if ((await artistManualFields(artistId)).includes('bio')) {
    dbLog('saveBio omitido: la bio fue editada a mano')
    return
  }
  const { error } = await supabase
    .from('artists')
    .update({ bio })
    .eq('id', artistId)
  if (error) throw error
}

async function updateArtistSpotifyId(artistId, spotifyId, imageUrl) {
  dbLog(`updateArtistSpotifyId artistId="${artistId}"`)
  const update = { external_spotify_id: spotifyId }
  if (imageUrl && !(await artistManualFields(artistId)).includes('image_url')) {
    update.image_url = imageUrl
  }
  const { error } = await supabase
    .from('artists')
    .update(update)
    .eq('id', artistId)
  if (error) throw error

  await saveMediaLinks([spotifyLinkRow('artist', artistId, spotifyId)])
}

async function saveTracks(spotifyTracks, albumId) {
  if (!spotifyTracks || !spotifyTracks.length) return []
  dbLog(`saveTracks albumId="${albumId}" count=${spotifyTracks.length}`)
  const payload = spotifyTracks.map(t => ({
    album_id: albumId,
    external_spotify_id: t.id,
    title: t.name,
    duration_ms: t.duration_ms || null,
    track_number: t.track_number,
    disc_number: t.disc_number || 1,
  }))
  const { data: existingTracks } = await supabase
    .from('tracks')
    .select('external_spotify_id, manual_fields')
    .eq('album_id', albumId)

  const protectedByTrack = new Map(
    (existingTracks || []).map(t => [t.external_spotify_id, t.manual_fields || []])
  )

  const { data, error } = await supabase
    .from('tracks')
    .upsert(
      payload.map(row => stripManualFields(row, protectedByTrack.get(row.external_spotify_id))),
      { onConflict: 'external_spotify_id' }
    )
    .select()
  if (error) throw error

  const saved = data || []
  await saveMediaLinks(
    saved.map(t => spotifyLinkRow('track', t.id, t.external_spotify_id))
  )
  return saved
}

/** Links de una entidad o de varias, agrupados por id. */
async function getMediaLinks(entityType, entityIds) {
  const ids = (entityIds || []).filter(Boolean)
  if (!ids.length) return []
  dbLog(`getMediaLinks entityType="${entityType}" count=${ids.length}`)
  const { data } = await supabase
    .from('media_links')
    .select('*')
    .eq('entity_type', entityType)
    .in('entity_id', ids)
  return data || []
}

async function getArtistBySlug(slug) {
  dbLog(`getArtistBySlug slug="${slug}"`)

  const { data } = await supabase.from('artists').select('*').eq('slug', slug).single()
  return data
}

/** external_mb_id de los artistas ocultos, para filtrar los resultados de MusicBrainz. */
async function getHiddenMbIds() {
  const { data } = await supabase
    .from('artists')
    .select('external_mb_id')
    .eq('hidden', true)
  return new Set((data || []).map(a => a.external_mb_id).filter(Boolean))
}

async function getArtistByMbId(mbId) {
  dbLog(`getArtistByMbId mbId="${mbId}"`)

  const { data } = await supabase.from('artists').select('*').eq('external_mb_id', mbId).single()
  return data
}

async function getArtistById(id) {
  dbLog(`getArtistById id="${id}"`)
  const { data } = await supabase.from('artists').select('*').eq('id', id).single()
  return data
}

async function getAlbumsByArtist(artistId) {
  dbLog(`getAlbumsByArtist artistId="${artistId}"`)

  const { data } = await supabase
    .from('albums')
    .select('*')
    .eq('artist_id', artistId)
    .eq('hidden', false)
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
  saveBio,
  updateArtistSpotifyId,
  saveTracks,
  saveMediaLinks,
  getMediaLinks,
  getArtistBySlug,
  getArtistByMbId,
  getArtistById,
  getHiddenMbIds,
  getAlbumsByArtist,
  getAlbumById,
  getTracksByAlbum,
  getTrackById,
}
