const axios = require('axios')

const ES_WIKI = 'https://es.wikipedia.org'
const HEADERS = {
  'User-Agent': 'LetterRockApp/1.0 (https://github.com/agusfmartinez/app-LetterRock)',
}

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')       // "Sui Generis (banda)" -> "sui generis"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * ¿El artículo es sobre este artista?
 *
 * La búsqueda de Wikipedia devuelve el mejor match textual, que puede no tener
 * nada que ver: para "A Magnificent Cold" devolvía el artículo del álbum
 * "Working Class Hero". Sin este chequeo esa bio quedaba guardada como si fuera
 * del artista.
 */
function titleMatchesArtist(title, name) {
  const wanted = normalize(name)
  const found = normalize(title)
  if (!wanted || !found) return false
  return found === wanted || found.startsWith(`${wanted} `) || found.endsWith(` ${wanted}`)
}

/** Las páginas de desambiguación no son una biografía. */
function isDisambiguation(extract) {
  const text = normalize(extract).slice(0, 200)
  return text.includes('puede referirse a') || text.includes('puede hacer referencia a')
}

async function fetchExtract(title) {
  const { data } = await axios.get(`${ES_WIKI}/w/api.php`, {
    params: {
      action: 'query',
      titles: title,
      prop: 'extracts',
      exintro: true,
      explaintext: true,
      format: 'json',
    },
    headers: HEADERS,
    timeout: 5000,
  })
  const pages = data?.query?.pages
  if (!pages) return null
  const page = pages[Object.keys(pages)[0]]
  if (!page || page.missing !== undefined) return null
  return page.extract?.trim() || null
}

async function getArtistBio(name) {
  console.log(`[Wikipedia] buscando: "${name}"`)

  const direct = await fetchExtract(name).catch(() => null)
  if (direct && !isDisambiguation(direct)) {
    console.log(`[Wikipedia] ${name}: found direct`)
    return direct
  }

  // Fallback: búsqueda por nombre, quedándose sólo con un artículo que
  // efectivamente sea sobre el artista.
  const { data: search } = await axios.get(`${ES_WIKI}/w/api.php`, {
    params: {
      action: 'query',
      list: 'search',
      srsearch: name,
      srnamespace: 0,
      srlimit: 5,
      format: 'json',
    },
    headers: HEADERS,
    timeout: 5000,
  })

  const results = search?.query?.search || []
  const candidate = results.find(r => titleMatchesArtist(r.title, name))

  if (!candidate) {
    const titles = results.map(r => r.title).join(', ') || 'ninguno'
    console.log(`[Wikipedia] ${name}: descartado, ningún artículo coincide (${titles})`)
    return null
  }

  const via = await fetchExtract(candidate.title).catch(() => null)
  if (via && isDisambiguation(via)) {
    console.log(`[Wikipedia] ${name}: "${candidate.title}" es desambiguación, descartado`)
    return null
  }

  console.log(`[Wikipedia] ${name}: found via search → "${candidate.title}"`)
  return via
}

module.exports = { getArtistBio }
