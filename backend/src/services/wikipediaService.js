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

/**
 * ¿El texto habla de música?
 *
 * Pedir el artículo por nombre acepta lo primero que exista con ese título, y
 * para "Almendra" eso es la fruta. Se mira el principio de la introducción: la
 * de un artista dice que es una banda, un músico, un cantante…
 */
const MUSIC_WORDS = /\b(banda|grupo|musical|musico|cantante|cantautor|compositor|guitarrista|bajista|baterista|pianista|tecladista|solista|duo|trio|rock|pop|punk|metal|blues|jazz|tango|folk|album|disco|discografia)\b/

function looksMusical(extract) {
  return MUSIC_WORDS.test(normalize(extract).slice(0, 400))
}

async function fetchExtracts(titles) {
  const { data } = await axios.get(`${ES_WIKI}/w/api.php`, {
    params: {
      action: 'query',
      titles: titles.join('|'),
      prop: 'extracts',
      exintro: true,
      explaintext: true,
      exlimit: 'max',
      redirects: 1,
      format: 'json',
    },
    headers: HEADERS,
    timeout: 5000,
  })
  // Con `redirects` el título pedido puede volver con otro nombre: se arma el
  // camino de vuelta para saber qué extracto corresponde a qué pedido.
  const alias = new Map()
  for (const r of [...(data?.query?.normalized || []), ...(data?.query?.redirects || [])]) {
    alias.set(r.from, r.to)
  }
  const byTitle = new Map()
  for (const page of Object.values(data?.query?.pages || {})) {
    if (page.missing === undefined && page.extract?.trim()) byTitle.set(page.title, page.extract.trim())
  }
  return titles.map(t => {
    let key = t
    for (let i = 0; i < 3 && alias.has(key); i++) key = alias.get(key)
    return byTitle.get(key) || null
  })
}

/** El artículo en español de un ítem de Wikidata, si existe. */
async function eswikiTitleFromWikidata(qid) {
  const { data } = await axios.get('https://www.wikidata.org/w/api.php', {
    params: { action: 'wbgetentities', ids: qid, props: 'sitelinks', sitefilter: 'eswiki', format: 'json' },
    headers: HEADERS,
    timeout: 5000,
  })
  return data?.entities?.[qid]?.sitelinks?.eswiki?.title || null
}

/**
 * La bio del artista: la introducción de su artículo en Wikipedia en español.
 *
 * Tres caminos, del más seguro al menos:
 *   1. Por Wikidata, con el id que MusicBrainz tiene enlazado. Es el artículo
 *      exacto, sin adivinar nada.
 *   2. Por nombre, probando primero los títulos que Wikipedia usa para
 *      desambiguar artistas ("Almendra (banda)") y recién después el nombre
 *      pelado. Sólo se acepta un texto que hable de música.
 *   3. Por búsqueda, con el mismo filtro y además el título tiene que coincidir.
 */
async function getArtistBio(name, wikidataId = null) {
  console.log(`[Wikipedia] buscando: "${name}"${wikidataId ? ` (${wikidataId})` : ''}`)

  if (wikidataId) {
    const title = await eswikiTitleFromWikidata(wikidataId).catch(() => null)
    if (title) {
      const [text] = await fetchExtracts([title]).catch(() => [null])
      if (text && !isDisambiguation(text)) {
        console.log(`[Wikipedia] ${name}: por Wikidata → "${title}"`)
        return text
      }
    }
  }

  const candidates = [
    `${name} (banda)`,
    `${name} (grupo musical)`,
    `${name} (banda de rock)`,
    `${name} (músico)`,
    `${name} (cantante)`,
    name,
  ]
  const texts = await fetchExtracts(candidates).catch(() => [])
  const hit = candidates.findIndex((_, i) => texts[i] && !isDisambiguation(texts[i]) && looksMusical(texts[i]))
  if (hit >= 0) {
    console.log(`[Wikipedia] ${name}: por nombre → "${candidates[hit]}"`)
    return texts[hit]
  }

  const { data: search } = await axios.get(`${ES_WIKI}/w/api.php`, {
    params: {
      action: 'query',
      list: 'search',
      srsearch: `${name} música`,
      srnamespace: 0,
      srlimit: 5,
      format: 'json',
    },
    headers: HEADERS,
    timeout: 5000,
  })

  const results = (search?.query?.search || []).filter(r => titleMatchesArtist(r.title, name))
  if (results.length) {
    const found = await fetchExtracts(results.map(r => r.title)).catch(() => [])
    const i = results.findIndex((_, j) => found[j] && !isDisambiguation(found[j]) && looksMusical(found[j]))
    if (i >= 0) {
      console.log(`[Wikipedia] ${name}: por búsqueda → "${results[i].title}"`)
      return found[i]
    }
  }

  console.log(`[Wikipedia] ${name}: sin artículo que hable del artista`)
  return null
}

module.exports = { getArtistBio, looksMusical }
