const axios = require('axios')

const ES_WIKI = 'https://es.wikipedia.org'
const HEADERS = {
  'User-Agent': 'LetterRockApp/1.0 (https://github.com/agusfmartinez/app-LetterRock)',
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
  if (direct) {
    console.log(`[Wikipedia] ${name}: found direct`)
    return direct
  }

  // Fallback: búsqueda por nombre
  const { data: search } = await axios.get(`${ES_WIKI}/w/api.php`, {
    params: {
      action: 'query',
      list: 'search',
      srsearch: name,
      srnamespace: 0,
      srlimit: 1,
      format: 'json',
    },
    headers: HEADERS,
    timeout: 5000,
  })

  const result = search?.query?.search?.[0]
  if (!result) {
    console.log(`[Wikipedia] ${name}: not found`)
    return null
  }

  const via = await fetchExtract(result.title).catch(() => null)
  console.log(`[Wikipedia] ${name}: found via search → "${result.title}"`)
  return via
}

module.exports = { getArtistBio }
