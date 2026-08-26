import { useState } from 'react'
import { Link } from 'react-router-dom'
import RequireEditor from '../components/common/RequireEditor'
import { useInvalidateCatalog } from '../hooks/useCatalogAdmin'
import { discoverArtists, saveDiscovered } from '../services/api'

const INPUT = 'bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent'

const TYPE_LABEL = { group: 'banda', person: 'músico', other: 'otro' }

function CandidateRow({ candidate, checked, onToggle }) {
  const years = [candidate.beginYear, candidate.endYear].filter(Boolean).join(' – ')
  const locked = candidate.inCatalog && !candidate.hidden

  return (
    <label
      className={`flex items-center gap-3 p-3 ${
        locked ? 'opacity-50' : 'cursor-pointer hover:bg-rock-dark/40'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(candidate.mbId)}
        disabled={locked}
      />

      <div className="flex-1 min-w-0">
        <span className="text-rock-text font-medium">{candidate.name}</span>
        {candidate.inCatalog && (
          <span className="text-gray-500 text-xs">
            {candidate.hidden ? ' · oculto en el catálogo' : ' · ya está'}
          </span>
        )}

        {/* Por qué apareció, cuando se buscó por disco. */}
        {candidate.matchedAlbum && (
          <p className="text-rock-accent text-xs">
            {candidate.matchedAlbum.title}
            {candidate.matchedAlbum.date && ` · ${candidate.matchedAlbum.date.slice(0, 4)}`}
          </p>
        )}

        <p className="text-gray-500 text-xs">
          {[
            years || null,
            candidate.country,
            TYPE_LABEL[candidate.type] || null,
            candidate.tags.join(', ') || null,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>

      {candidate.slug && (
        <Link
          to={`/artist/${candidate.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-rock-accent text-xs flex-shrink-0"
        >
          ver →
        </Link>
      )}

      <a
        href={`https://musicbrainz.org/artist/${candidate.mbId}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="text-gray-600 hover:text-rock-accent text-xs flex-shrink-0"
      >
        MB →
      </a>
    </label>
  )
}

/**
 * Poblar el catálogo desde MusicBrainz.
 *
 * Tres filtros que se combinan: nombre del artista, título de un disco y rango
 * de años. Buscar por disco usa otro índice —el título vive en el disco, no en
 * el artista— y devuelve a quién pertenece: "Vida" entre 1970 y 1979 trae
 * Sui Generis.
 *
 * No se puede pedir "los discos argentinos de los 80" y listo: el índice de
 * discos de MusicBrainz no guarda el país del artista, y filtrar por país ahí
 * lo ignora en silencio. Por eso lo que se agrega son artistas, y sus discos
 * entran después por la ingesta de Spotify.
 */
export default function AdminDiscover() {
  const [form, setForm] = useState({ artist: '', album: '', from: '', to: '' })
  const [result, setResult] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(null)
  const invalidate = useInvalidateCatalog()

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const filters = {
    artist: form.artist.trim(),
    album: form.album.trim(),
    from: form.from ? Number(form.from) : null,
    to: form.to ? Number(form.to) : null,
  }

  const empty = !filters.artist && !filters.album && !filters.from && !filters.to

  const search = async (offset = 0) => {
    setBusy(true)
    setError('')
    setSaved(null)
    if (offset === 0) {
      setResult(null)
      setSelected(new Set())
    }
    try {
      const data = await discoverArtists(filters, offset)
      setResult(prev => {
        if (offset === 0 || !prev) return data
        // Deduplicar por id: MusicBrainz puede devolver el mismo artista en dos
        // páginas si alguien lo editó entre una y otra, y dos filas con la
        // misma key rompen el listado.
        const seen = new Set(prev.artists.map(a => a.mbId))
        return { ...data, artists: [...prev.artists, ...data.artists.filter(a => !seen.has(a.mbId))] }
      })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo consultar MusicBrainz')
    } finally {
      setBusy(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (!empty) search(0)
  }

  const toggle = (mbId) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(mbId) ? next.delete(mbId) : next.add(mbId)
      return next
    })
  }

  const selectAllNew = () => {
    const ids = (result?.artists || []).filter(a => !a.inCatalog).map(a => a.mbId)
    setSelected(prev => (prev.size === ids.length ? new Set() : new Set(ids)))
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await saveDiscovered([...selected])
      setSaved(data)
      setSelected(new Set())
      invalidate()
      const added = new Set(data.artists.map(a => a.name))
      setResult(prev => prev && {
        ...prev,
        artists: prev.artists.map(a => (added.has(a.name) ? { ...a, inCatalog: true, hidden: false } : a)),
      })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudieron guardar')
    } finally {
      setBusy(false)
    }
  }

  const shown = result?.artists.length || 0
  // Lo que falta arriba y lo que ya está abajo: el editor viene a ver qué le
  // falta, y mezclarlos lo obliga a leer toda la lista para encontrarlo.
  const nuevos = (result?.artists || []).filter(a => !a.inCatalog)
  const cargados = (result?.artists || []).filter(a => a.inCatalog)

  return (
    <RequireEditor>
      <div className="space-y-6 max-w-3xl">
        <div>
          <Link to="/admin/catalogo" className="text-gray-400 hover:text-rock-accent text-sm">
            ← Catálogo
          </Link>
          <h1 className="text-2xl font-bold text-rock-text mt-2">Descubrir bandas</h1>
          <p className="text-gray-500 text-sm mt-1">
            Buscar en MusicBrainz por nombre, por disco o por período. Lo que
            agregues trae su discografía de Spotify en segundo plano.
          </p>
        </div>

        <form onSubmit={submit} className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs text-gray-500">Artista o banda</span>
            <input
              value={form.artist}
              onChange={set('artist')}
              placeholder="Spinetta"
              className={`w-full ${INPUT}`}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-gray-500">Disco</span>
            <input
              value={form.album}
              onChange={set('album')}
              placeholder="Vida"
              className={`w-full ${INPUT}`}
            />
            <span className="block text-[11px] text-gray-600">
              Devuelve el artista al que pertenece. Un título común trae de todo:
              acotalo con el período.
            </span>
          </label>

          <div className="flex items-end gap-2 flex-wrap">
            <label className="space-y-1">
              <span className="block text-xs text-gray-500">Desde</span>
              <input
                value={form.from}
                onChange={set('from')}
                type="number"
                placeholder="1970"
                className={`w-24 ${INPUT}`}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-gray-500">Hasta</span>
              <input
                value={form.to}
                onChange={set('to')}
                type="number"
                placeholder="1979"
                className={`w-24 ${INPUT}`}
              />
            </label>

            <button
              type="submit"
              disabled={busy || empty}
              className="bg-rock-accent text-white px-4 py-2 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          <p className="text-[11px] text-gray-600">
            Sin disco, el período es el año en que el artista se formó — o el de
            nacimiento, si es una persona.
          </p>
        </form>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {saved && (
          <div className="border border-rock-accent rounded-lg p-3 text-sm">
            <p className="text-rock-accent">
              {saved.saved} {saved.saved === 1 ? 'artista agregado' : 'artistas agregados'}.
              Sus discos se están trayendo de Spotify.
            </p>
            {saved.expired > 0 && (
              <p className="text-gray-500 text-xs mt-1">
                {saved.expired} quedaron fuera porque la búsqueda venció. Volvé a
                buscar y agregalos de nuevo.
              </p>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <span className="text-gray-500">
                {shown}{result.total > shown ? ` de ${result.total}` : ''} · {nuevos.length} sin cargar
              </span>
              {result.filtered > 0 && (
                <span className="text-gray-600 text-xs">
                  {result.filtered} descartados por género
                </span>
              )}
              {nuevos.length > 0 && (
                <button
                  onClick={selectAllNew}
                  className="text-gray-400 hover:text-rock-accent text-xs"
                >
                  {selected.size === nuevos.length ? 'Deseleccionar todos' : 'Seleccionar los que faltan'}
                </button>
              )}
              <button
                onClick={save}
                disabled={busy || selected.size === 0}
                className="ml-auto bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-30"
              >
                Agregar {selected.size > 0 ? `(${selected.size})` : ''}
              </button>
            </div>

            {result.artists.length === 0 ? (
              <p className="text-gray-500 text-sm">
                MusicBrainz no devolvió nada con esos filtros.
              </p>
            ) : (
              <div className="space-y-5">
                {nuevos.length > 0 && (
                  <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
                    {nuevos.map(c => (
                      <CandidateRow
                        key={c.mbId}
                        candidate={c}
                        checked={selected.has(c.mbId)}
                        onToggle={toggle}
                      />
                    ))}
                  </div>
                )}

                {cargados.length > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs mb-2">
                      Ya en el catálogo ({cargados.length})
                    </p>
                    <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border">
                      {cargados.map(c => (
                        <CandidateRow
                          key={c.mbId}
                          candidate={c}
                          checked={selected.has(c.mbId)}
                          onToggle={toggle}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {result.hasMore && (
              <button
                onClick={() => search(result.nextOffset)}
                disabled={busy}
                className="text-gray-500 hover:text-rock-accent text-sm disabled:opacity-50"
              >
                {busy ? 'Buscando...' : 'Traer más'}
              </button>
            )}
          </div>
        )}
      </div>
    </RequireEditor>
  )
}
