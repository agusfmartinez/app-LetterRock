import { useState } from 'react'
import RequireEditor from '../components/common/RequireEditor'
import AdminLayout from '../components/common/AdminLayout'
import { useInvalidateCatalog } from '../hooks/useCatalogAdmin'
import { discoverArtists, saveDiscovered } from '../services/api'
import ArrowLink from '../components/common/ArrowLink'
import { IconCheck } from '../components/common/Icons'

const TYPE_LABEL = { group: 'banda', person: 'músico', other: 'otro' }

/*
 * El período se busca en MusicBrainz por año de formación o de nacimiento. Antes
 * de 1950 no hay rock que buscar, y después de este año no hay nada todavía.
 */
const MIN_YEAR = 1950
const MAX_YEAR = new Date().getFullYear()

// Un campo de año no acepta signo, exponente ni decimales: `type="number"`
// los deja escribir igual.
const blockNonDigits = (e) => {
  if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault()
}

const LABEL = 'block text-[13px] text-gray-400 mb-1.5'

function CandidateRow({ candidate, checked, onToggle }) {
  const years = [candidate.beginYear, candidate.endYear].filter(Boolean).join(' – ')
  const locked = candidate.inCatalog && !candidate.hidden
  const meta = [
    years || null,
    TYPE_LABEL[candidate.type] || null,
    candidate.tags.join(', ') || null,
  ].filter(Boolean).join(' · ')

  return (
    <label
      className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors ${
        locked ? 'opacity-55' : 'cursor-pointer hover:bg-white/[0.03]'
      } ${checked ? 'bg-rock-accent/[0.07]' : ''}`}
    >
      <input
        type="checkbox"
        className="check"
        checked={checked}
        onChange={() => onToggle(candidate.mbId)}
        disabled={locked}
        aria-label={`Importar ${candidate.name}`}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-rock-text font-medium text-[15px]">{candidate.name}</span>
          {candidate.country && <span className="tag tag-neutral !text-[10.5px]">{candidate.country}</span>}
          {candidate.inCatalog && (
            <span className="text-gray-500 text-[12px]">
              {candidate.hidden ? 'oculto en el catálogo' : 'ya está'}
            </span>
          )}
        </div>

        {/* Por qué apareció, cuando se buscó por disco. */}
        {candidate.matchedAlbum && (
          <p className="text-rock-accent text-[12.5px] mt-0.5">
            {candidate.matchedAlbum.title}
            {candidate.matchedAlbum.date && ` · ${candidate.matchedAlbum.date.slice(0, 4)}`}
          </p>
        )}

        {meta && <p className="text-gray-500 text-[12.5px] mt-0.5 truncate">{meta}</p>}
      </div>

      {candidate.slug && (
        <ArrowLink to={`/artist/${candidate.slug}`} target="_blank" rel="noopener noreferrer">Ver</ArrowLink>
      )}

      {/* stopPropagation: la fila entera es un <label> que tilda el candidato,
          y abrir MusicBrainz no debería marcarlo. */}
      <ArrowLink
        href={`https://musicbrainz.org/artist/${candidate.mbId}`}
        onClick={e => e.stopPropagation()}
        className="hidden sm:inline-flex"
      >
        MusicBrainz
      </ArrowLink>
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
  // Buscar e importar por separado: con un solo `busy`, importar ponía
  // "Buscando…" en el botón del formulario.
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [saved, setSaved] = useState(null)
  // El error de años se muestra recién al buscar: mientras se escribe "19",
  // todavía no está mal.
  const [yearTried, setYearTried] = useState(false)
  const invalidate = useInvalidateCatalog()

  const set = (key) => (e) => {
    if (key === 'from' || key === 'to') setYearTried(false)
    setForm({ ...form, [key]: e.target.value })
  }

  const filters = {
    artist: form.artist.trim(),
    album: form.album.trim(),
    from: form.from ? Number(form.from) : null,
    to: form.to ? Number(form.to) : null,
  }

  const empty = !filters.artist && !filters.album && !filters.from && !filters.to

  const badYear = (y) => y !== null && (!Number.isInteger(y) || y < MIN_YEAR || y > MAX_YEAR)
  const yearError =
    badYear(filters.from) || badYear(filters.to)
      ? `Los años van de ${MIN_YEAR} a ${MAX_YEAR}.`
      : filters.from && filters.to && filters.from > filters.to
        ? 'El primer año no puede ser posterior al segundo.'
        : ''

  const search = async (offset = 0) => {
    setSearching(true)
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
      setSearching(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (yearError) { setYearTried(true); return }
    if (!empty) search(0)
  }

  const toggle = (mbId) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(mbId) ? next.delete(mbId) : next.add(mbId)
      return next
    })
  }

  // Lo que se puede tildar desde "seleccionar todos": lo que falta en el catálogo.
  const importable = (result?.artists || []).filter(a => !a.inCatalog)

  const selectAllNew = () => {
    const ids = importable.map(a => a.mbId)
    setSelected(prev => (prev.size === ids.length ? new Set() : new Set(ids)))
  }

  const save = async () => {
    setImporting(true)
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
      setImporting(false)
    }
  }

  const shown = result?.artists.length || 0
  // Lo que falta arriba y lo que ya está abajo: el editor viene a ver qué le
  // falta, y mezclarlos lo obliga a leer toda la lista para encontrarlo.
  const nuevos = (result?.artists || []).filter(a => !a.inCatalog)
  const cargados = (result?.artists || []).filter(a => a.inCatalog)

  return (
    <RequireEditor>
      <AdminLayout
        title="Panel"
        lead="Buscar en MusicBrainz por nombre, por disco o por período. Lo que agregues trae su discografía de Spotify en segundo plano."
      >
        <form onSubmit={submit} className="card space-y-4" noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Artista o banda</span>
              <input
                value={form.artist}
                onChange={set('artist')}
                placeholder="Nombre"
                className="input"
              />
            </label>

            <label className="block">
              <span className={LABEL}>Disco</span>
              <input
                value={form.album}
                onChange={set('album')}
                placeholder="Título del disco"
                className="input"
              />
            </label>
          </div>

          <div>
            <span className={LABEL}>Período</span>
            <div className="flex items-center gap-2.5">
              <input
                value={form.from}
                onChange={set('from')}
                onKeyDown={blockNonDigits}
                type="number"
                inputMode="numeric"
                min={MIN_YEAR}
                max={MAX_YEAR}
                placeholder={String(MIN_YEAR)}
                aria-label="Desde"
                className="input !w-28"
              />
              <span className="text-gray-500 text-sm">a</span>
              <input
                value={form.to}
                onChange={set('to')}
                onKeyDown={blockNonDigits}
                type="number"
                inputMode="numeric"
                min={MIN_YEAR}
                max={MAX_YEAR}
                placeholder={String(MAX_YEAR)}
                aria-label="Hasta"
                className="input !w-28"
              />
            </div>
            {yearTried && yearError && <p className="field-error">{yearError}</p>}
          </div>

          {/* Las aclaraciones juntas abajo, y el botón al final: es lo último
              que se hace. */}
          <div className="flex items-end gap-4 flex-wrap border-t border-rock-border pt-4">
            <div className="flex-1 min-w-[240px] space-y-1 text-[12px] leading-relaxed text-gray-500">
              <p>Por disco devuelve el artista al que pertenece. Un título común trae de todo: acotalo con el período.</p>
              <p>Sin disco, el período es el año en que la banda se formó, o el de nacimiento si es un artista.</p>
            </div>
            <button type="submit" disabled={searching || empty} className="btn btn-primary ml-auto px-7">
              {searching ? 'Buscando…' : 'Buscar'}
            </button>
          </div>
        </form>

        {error && <p className="text-rock-accentBright text-sm">{error}</p>}


        {result && (
          <div className="space-y-4 mt-4">
            <p className="text-[13.5px] text-gray-400">
              {result.artists.length === 0 ? (
                'MusicBrainz no devolvió nada con esos filtros.'
              ) : (
                <>
                  <span className="text-rock-text font-medium">{nuevos.length}</span> para importar
                  {cargados.length > 0 && ` · ${cargados.length} ya en el catálogo`}
                  {result.total > shown && ` · mostrando ${shown} de ${result.total}`}
                  {result.filtered > 0 && ` · ${result.filtered} descartados por género`}
                </>
              )}
            </p>

            {nuevos.length > 0 && (
              <>
                <div className="card !p-0 overflow-hidden">
                  {/* Seleccionar todos, como cabecera de la misma lista. */}
                  <label className="flex items-center gap-3.5 px-4 py-3 border-b border-rock-border bg-rock-dark/40 cursor-pointer">
                    <input
                      type="checkbox"
                      className="check"
                      checked={importable.length > 0 && selected.size === importable.length}
                      ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < importable.length }}
                      onChange={selectAllNew}
                    />
                    <span className="text-[13.5px] text-gray-300">Seleccionar todos</span>
                    <span className="ml-auto text-[12.5px] text-gray-500">
                      {selected.size} de {importable.length}
                    </span>
                  </label>
                  <div className="divide-y divide-rock-border">
                    {nuevos.map(c => (
                      <CandidateRow
                        key={c.mbId}
                        candidate={c}
                        checked={selected.has(c.mbId)}
                        onToggle={toggle}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={save}
                  disabled={importing || selected.size === 0}
                  className="btn btn-primary px-7"
                >
                  {importing
                    ? 'Importando…'
                    : `Importar${selected.size > 0 ? ` (${selected.size})` : ''}`}
                </button>
              </>
            )}

            {/* El aviso va donde se importó, no arriba del formulario: ahí es
                donde está mirando quien acaba de tocar el botón. */}
            {saved && (
              <div role="status" className="flex items-start gap-3 rounded-[14px] bg-rock-accent/10 px-4 py-3 text-[13.5px]">
                <span className="mt-0.5 text-rock-accent flex-none"><IconCheck size={16} /></span>
                <div>
                  <p className="text-rock-text">
                    {saved.saved} {saved.saved === 1 ? 'artista importado' : 'artistas importados'}.{' '}
                    <span className="text-gray-400">Sus discos se están trayendo de Spotify.</span>
                  </p>
                  {saved.expired > 0 && (
                    <p className="text-gray-500 text-xs mt-1">
                      {saved.expired} quedaron fuera porque la búsqueda venció. Volvé a
                      buscar e importalos de nuevo.
                    </p>
                  )}
                </div>
              </div>
            )}

            {nuevos.length === 0 && cargados.length > 0 && (
              <p className="text-gray-500 text-sm">Todo lo que encontró ya está en el catálogo.</p>
            )}

            {cargados.length > 0 && (
              <div className="pt-2">
                <p className="kicker mb-2.5">Ya en el catálogo ({cargados.length})</p>
                <div className="card !p-0 overflow-hidden divide-y divide-rock-border">
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

            {result.hasMore && (
              <button
                onClick={() => search(result.nextOffset)}
                disabled={searching}
                className="btn btn-secondary"
              >
                {searching ? 'Buscando…' : 'Traer más'}
              </button>
            )}
          </div>
        )}
      </AdminLayout>
    </RequireEditor>
  )
}
