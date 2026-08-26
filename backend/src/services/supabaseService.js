const { createClient } = require('@supabase/supabase-js')
const slugify = require('slugify')
const mb = require('./musicbrainz')

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
    artist_type: mb.normalizeArtistType(mbArtist.type),
  }

  // Igual que `saveAlbum`: esta función corre en cada visita al artista, así
  // que sin esto un nombre o un año corregidos desde el CRUD volverían al
  // valor de MusicBrainz.
  const { data: existing } = await supabase
    .from('artists')
    .select('manual_fields')
    .eq('external_mb_id', mbArtist.id)
    .maybeSingle()

  const { data, error } = await supabase
    .from('artists')
    .upsert(stripManualFields(payload, existing?.manual_fields), { onConflict: 'external_mb_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Completa el tipo de artista sin pisar al editor.
 *
 * Se llama al importar la formación, que es el único momento en que se vuelve a
 * consultar MusicBrainz por un artista ya cargado. Si el editor lo corrigió a
 * mano queda como está: MusicBrainz clasifica mal a más de uno.
 */
async function saveArtistType(artistId, artistType) {
  if (!artistType) return false

  const { data: artist } = await supabase
    .from('artists')
    .select('artist_type, manual_fields')
    .eq('id', artistId)
    .single()

  if (!artist) return false
  if (artist.artist_type === artistType) return false
  if ((artist.manual_fields || []).includes('artist_type')) return false

  dbLog(`saveArtistType id="${artistId}" type="${artistType}"`)
  const { error } = await supabase
    .from('artists')
    .update({ artist_type: artistType })
    .eq('id', artistId)
  if (error) throw error
  return true
}

/**
 * Deja constancia de que una ingesta corrió para este artista.
 *
 * Las columnas van por nombre fijo y no por parámetro libre: son parte del
 * código, no dato del usuario, y así no hay forma de escribir en otra columna
 * pasando un string raro.
 */
const RUN_COLUMNS = {
  spotify: 'spotify_refreshed_at',
  youtube: 'youtube_linked_at',
  members: 'members_imported_at',
}

async function markArtistRun(artistId, kind) {
  const column = RUN_COLUMNS[kind]
  if (!column) throw new Error(`Ingesta desconocida: ${kind}`)

  dbLog(`markArtistRun ${kind} id="${artistId}"`)
  const { error } = await supabase
    .from('artists')
    .update({ [column]: new Date().toISOString() })
    .eq('id', artistId)
  if (error) throw error
}

async function artistsByMbId(mbIds) {
  const ids = [...new Set(mbIds.filter(Boolean))]
  if (ids.length === 0) return new Map()
  const { data } = await supabase
    .from('artists')
    .select('id, name, external_mb_id')
    .in('external_mb_id', ids)
  return new Map((data || []).map(a => [a.external_mb_id, a]))
}

/**
 * Guarda etapas de "fulano tocó en tal banda" tal como las trajo MusicBrainz.
 *
 * Sirve para las dos direcciones: la formación de una banda y las bandas por
 * las que pasó un músico. `mb_key` se arma siempre desde el músico, así que
 * importar los dos lados de la misma relación cae en la misma fila.
 *
 * `mb_key` también hace la importación repetible: si un editor corrigió el año
 * de una etapa, la próxima corrida actualiza esa fila en vez de duplicarla.
 *
 * `member_id` se completa sólo cuando el músico ya está en el catálogo. Los
 * demás quedan con el nombre suelto: un segundo guitarrista sin discografía no
 * necesita ficha propia para figurar en la formación.
 */
async function saveMembers(stages) {
  if (stages.length === 0) return { saved: 0, linked: 0, skipped: 0 }

  const catalog = await artistsByMbId([
    ...stages.map(s => s.person_mb_id),
    ...stages.map(s => s.band_mb_id),
  ])

  const keysByGroup = new Map()
  for (const stage of stages) {
    const group = catalog.get(stage.band_mb_id)
    if (!group) continue
    if (!keysByGroup.has(group.id)) keysByGroup.set(group.id, [])
    keysByGroup.get(group.id).push(stage.mb_key)
  }

  const manualByKey = new Map()
  for (const [groupId, keys] of keysByGroup) {
    const { data } = await supabase
      .from('artist_members')
      .select('mb_key, manual_fields')
      .eq('group_id', groupId)
      .in('mb_key', keys)
    for (const row of data || []) manualByKey.set(`${groupId}:${row.mb_key}`, row.manual_fields)
  }

  const rows = []
  let skipped = 0
  let linked = 0

  for (const stage of stages) {
    // La banda tiene que existir en el catálogo: `group_id` es obligatorio. Al
    // importar un solista, las bandas que todavía no cargamos se saltean.
    const group = catalog.get(stage.band_mb_id)
    if (!group) {
      skipped++
      continue
    }

    const person = catalog.get(stage.person_mb_id)
    if (person) linked++

    rows.push(stripManualFields(
      {
        group_id: group.id,
        member_id: person?.id || null,
        member_mb_id: stage.person_mb_id,
        // El nombre del músico: del otro extremo si estamos mirando la banda,
        // o del propio artista del catálogo si estamos mirando a la persona.
        member_name: person?.name || stage.other_name,
        roles: stage.roles,
        year_from: stage.year_from,
        year_to: stage.year_to,
        is_original: stage.is_original,
        ended: stage.ended,
        mb_key: stage.mb_key,
        source: 'musicbrainz',
      },
      manualByKey.get(`${group.id}:${stage.mb_key}`)
    ))
  }

  if (rows.length === 0) return { saved: 0, linked: 0, skipped }

  const { error } = await supabase
    .from('artist_members')
    .upsert(rows, { onConflict: 'group_id,mb_key' })
  if (error) throw error

  return { saved: rows.length, linked, skipped }
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
  saveMembers,
  saveArtistType,
  markArtistRun,
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
