import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfirm } from './ConfirmDialog'
import ImageField from './ImageField'
import {
  describeError,
  EMPTY_ALBUM_FILTERS,
  useAlbumSearch,
  useCollectionAdmin,
  useTrackSearch,
} from '../../hooks/useCollectionAdmin'
import { groupEntriesByYear, nextPositionInYear } from '../../hooks/useCollections'
import { albumYear, formatReleaseDate } from '../../services/dates'
import { linkAlbumToYoutube, linkArtistDiscography, refreshYoutubeViews } from '../../services/api'

const INPUT = 'bg-rock-dark border border-rock-border rounded px-3 py-2 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent'

/*
 * Piezas del editor de entradas, compartidas por las dos formas de cargar una
 * colección: por época (una timeline tiene secciones) y plana (una lista o un
 * ranking no tienen). Vivían dentro de la pantalla de sección; se sacaron acá
 * cuando lista y ranking dejaron de ser una timeline disfrazada.
 */

/** Siguiente lugar al final de una colección sin épocas. */
function nextPosition(entries) {
  return Math.max(0, ...(entries || []).map(e => e.position || 0)) + 1
}

/** Fila de una línea. No despliega nada: al elegirla se edita en el panel derecho. */
export function EntryRow({ entry, selected, onSelect, onMove, canMoveUp, canMoveDown, moving }) {
  // Una canción se muestra con la portada y la banda de su disco, y con su
  // propio título: es lo único suyo que la distingue en la fila.
  const album = entry.album || entry.track?.album
  const artist = entry.artist || album?.artist
  const label = entry.track?.title || entry.album?.title || entry.artist?.name || entry.title || 'Bloque de texto'
  const dateLabel = album ? formatReleaseDate(album) : entry.year ? String(entry.year) : null

  return (
    <div
      className={`flex items-center transition-colors ${
        selected ? 'bg-rock-accent/10 border-l-2 border-rock-accent' : 'hover:bg-rock-dark'
      }`}
    >
      {/* Las flechas van fuera del botón de selección: un botón adentro de otro
          no es HTML válido y el click se lo comería el de afuera. Sin `onMove`
          no se dibujan: en un ranking el orden lo fija el puesto. */}
      {onMove && (
      <div className="flex flex-col pl-2 flex-shrink-0">
        {[
          { dir: -1, label: '▲', can: canMoveUp, title: 'Subir dentro del año' },
          { dir: 1, label: '▼', can: canMoveDown, title: 'Bajar dentro del año' },
        ].map(({ dir, label: arrow, can, title }) => (
          <button
            key={dir}
            onClick={() => onMove(dir)}
            disabled={!can || moving}
            title={title}
            className="text-[10px] leading-none text-gray-600 hover:text-rock-accent disabled:opacity-20 disabled:hover:text-gray-600 py-0.5"
          >
            {arrow}
          </button>
        ))}
      </div>
      )}

      <button
        onClick={onSelect}
        className="flex-1 min-w-0 text-left flex items-center gap-3 px-3 py-2"
      >
        <div className="w-9 h-9 rounded overflow-hidden bg-rock-dark flex-shrink-0">
          {album?.cover_url ? (
            <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
          ) : entry.artist?.image_url ? (
            <img src={entry.artist.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm">
              {entry.track ? '🎵' : '📝'}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${selected ? 'text-rock-accent font-semibold' : 'text-rock-text'}`}>
            {label}
          </p>
          <p className="text-gray-500 text-xs truncate">
            {artist?.name}
            {artist?.name && dateLabel ? ' · ' : ''}
            {dateLabel}
          </p>
        </div>

        {!entry.body_text && <span className="text-xs text-gray-600 flex-shrink-0">sin texto</span>}
      </button>
    </div>
  )
}

export function EntriesByYear({ entries, selectedId, onSelect }) {
  const groups = useMemo(() => groupEntriesByYear(entries), [entries])
  const { reorderEntries } = useCollectionAdmin()

  // Intercambia dos entradas del año y guarda el orden completo del año.
  const move = (group, index, delta) => {
    const target = index + delta
    if (target < 0 || target >= group.entries.length) return
    const next = [...group.entries]
    ;[next[index], next[target]] = [next[target], next[index]]
    reorderEntries.mutate(next)
  }

  return (
    <div className="space-y-4">
      {groups.map(group => (
        <div key={group.label}>
          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="text-lg font-black text-rock-accent">{group.label}</h3>
            <span className="text-gray-600 text-xs">
              {group.entries.length} {group.entries.length === 1 ? 'entrada' : 'entradas'}
            </span>
            {group.entries.some(e => e.position > 0) && (
              <span
                className="text-gray-600 text-xs"
                title="Este año quedó en el orden que elegiste; las entradas nuevas se agregan al final"
              >
                · orden manual
              </span>
            )}
          </div>
          <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border overflow-hidden">
            {group.entries.map((e, i) => (
              <EntryRow
                key={e.id}
                entry={e}
                selected={selectedId === e.id}
                onSelect={() => onSelect(e.id)}
                onMove={delta => move(group, i, delta)}
                canMoveUp={i > 0}
                canMoveDown={i < group.entries.length - 1}
                moving={reorderEntries.isPending}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Entradas de una colección sin épocas, en una sola secuencia.
 *
 * En un ranking manda el puesto, así que las flechas no aparecen: el orden se
 * cambia editando el número, que es el dato que además se publica. En una lista
 * el orden es el `position` y se acomoda con las flechas.
 */
export function EntriesFlat({ entries, selectedId, onSelect, isRanking = false }) {
  const { reorderEntries, setRanks } = useCollectionAdmin()

  const move = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= entries.length) return
    const next = [...entries]
    ;[next[index], next[target]] = [next[target], next[index]]
    // En un ranking lo que se guarda es el puesto; en una lista, la posición.
    // Son dos columnas distintas para dos cosas distintas: el puesto se publica,
    // la posición es sólo el orden en que el editor quiso dejarlos.
    ;(isRanking ? setRanks : reorderEntries).mutate(next)
  }

  const moving = reorderEntries.isPending || setRanks.isPending

  if (entries.length === 0) {
    return <p className="text-gray-500 text-sm">Todavía no hay entradas.</p>
  }

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg divide-y divide-rock-border overflow-hidden">
      {entries.map((e, i) => (
        <div key={e.id} className="flex items-center">
          {/* El número sólo en el ranking: ahí es el contenido. En una lista
              sería un adorno que se lee como si fuera un puesto. */}
          {isRanking && (
            <span className="pl-3 text-rock-accent font-bold text-sm w-8 text-right tabular-nums flex-shrink-0">
              {e.rank ?? '—'}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <EntryRow
              entry={e}
              selected={selectedId === e.id}
              onSelect={() => onSelect(e.id)}
              onMove={delta => move(i, delta)}
              canMoveUp={i > 0}
              canMoveDown={i < entries.length - 1}
              moving={moving}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Único formulario de edición de la página. Se remonta con `key={entry.id}`
 * al cambiar de entrada, así el estado local arranca limpio.
 */
export function EntryEditor({ entry, onClose, isRanking = false, siblings = [] }) {
  const { updateEntry, deleteEntry, setRanks } = useCollectionAdmin()
  const confirm = useConfirm()
  const [form, setForm] = useState({
    body_text: entry.body_text || '',
    title: entry.title || '',
    year: entry.year ?? '',
    image_url: entry.image_url || '',
    rank: entry.rank ?? '',
  })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const album = entry.album || entry.track?.album
  const isNarrative = entry.entry_type === 'narrative'
  const label = entry.track?.title || entry.album?.title || entry.artist?.name || entry.title || 'Bloque de texto'

  const set = (key) => (e) => {
    setSaved(false)
    setForm({ ...form, [key]: e.target.value })
  }

  const save = () => {
    const patch = { id: entry.id, body_text: form.body_text.trim() || null }
    if (isRanking) {
      /*
       * El puesto no se escribe, se mueve. Escribirlo tal cual dejaría dos
       * discos en el mismo número, o un hueco donde estaba el que se movió.
       * Acá se saca la entrada de la secuencia y se la vuelve a meter en el
       * lugar pedido; después `setRanks` renumera todo de 1 a N.
       */
      const wanted = Number(form.rank)
      if (Number.isFinite(wanted) && wanted !== entry.rank && siblings.length > 0) {
        const target = Math.min(Math.max(1, wanted), siblings.length)
        const rest = siblings.filter(s => s.id !== entry.id)
        rest.splice(target - 1, 0, entry)
        setRanks.mutate(rest)
      }
    }
    if (isNarrative) {
      patch.title = form.title.trim() || null
      patch.year = form.year ? Number(form.year) : null
      patch.image_url = form.image_url.trim() || null
    }
    updateEntry.mutate(patch, {
      onSuccess: () => { setError(''); setSaved(true) },
      onError: e => setError(describeError(e)),
    })
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Quitar entrada',
      message: `¿Quitar "${label}" de esta sección?`,
      confirmLabel: 'Quitar',
    })
    if (!ok) return
    deleteEntry.mutate(entry.id, {
      onSuccess: onClose,
      onError: e => setError(describeError(e)),
    })
  }

  return (
    <div className="bg-rock-card border border-rock-accent rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        {album?.cover_url && (
          <img src={album.cover_url} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-rock-text font-semibold truncate">{label}</p>
          <p className="text-gray-500 text-xs truncate">
            {[(entry.artist || album?.artist)?.name, entry.track ? album?.title : null]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-rock-text text-sm flex-shrink-0">
          ✕
        </button>
      </div>

      {isNarrative && (
        <div className="flex gap-2 flex-wrap">
          <input value={form.title} onChange={set('title')} placeholder="Título del bloque" className={`flex-1 min-w-[140px] ${INPUT}`} />
          <input value={form.year} onChange={set('year')} placeholder="Año" type="number" className={`w-24 ${INPUT}`} />
        </div>
      )}

      {/* En un ranking el número es el contenido, no un detalle: sin puesto la
          entrada queda al final y el ranking no dice nada.

          De dónde salió el ranking va en la descripción de la colección: es un
          dato de la lista entera, y tenerlo por entrada dejaba que cada puesto
          dijera una cosa distinta. */}
      {isRanking && (
        <label className="block space-y-1">
          <span className="block text-xs text-gray-500">
            Puesto {siblings.length > 0 && `(1 a ${siblings.length})`}
          </span>
          <input
            value={form.rank}
            onChange={set('rank')}
            type="number"
            min="1"
            max={siblings.length || undefined}
            className={`w-24 ${INPUT}`}
          />
        </label>
      )}

      <textarea
        value={form.body_text}
        onChange={set('body_text')}
        placeholder="Texto editorial. Una línea en blanco separa párrafos."
        rows={10}
        className={`w-full ${INPUT}`}
      />

      {/*
        No se precarga la descripción sola: mientras el campo esté vacío la
        timeline la muestra igual, y así sigue en sincronía si después se edita
        el disco. Copiarla es un acto explícito, para partir de ese texto.
      */}
      {!form.body_text.trim() && album?.description && (
        <div className="text-gray-600 text-xs space-y-1">
          <p>
            Vacío: la timeline muestra la descripción del disco. Escribí acá para
            contar qué significa en esta colección.
          </p>
          <button
            onClick={() => { setSaved(false); setForm({ ...form, body_text: album.description }) }}
            className="text-rock-accent hover:underline"
          >
            Copiar la descripción para editarla acá
          </button>
        </div>
      )}

      {isNarrative && (
        <ImageField
          value={form.image_url}
          onChange={url => { setSaved(false); setForm(f => ({ ...f, image_url: url })) }}
          folder="entries"
        />
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={updateEntry.isPending}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Guardar
        </button>
        {saved && <span className="text-xs text-gray-500">Guardado</span>}
        <button onClick={remove} className="ml-auto text-xs text-gray-500 hover:text-red-400">
          Quitar de la sección
        </button>
      </div>

      {album && <YoutubePanel albumId={album.id} artist={album.artist} />}
    </div>
  )
}

/**
 * Vinculación con YouTube Music. Se dispara a mano porque la búsqueda cuesta
 * 100 de las 10.000 unidades diarias de cuota; el refresco de reproducciones
 * cuesta 1 cada 50 temas y se puede repetir sin problema.
 */
function YoutubePanel({ albumId, artist }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action, label) => {
    setBusy(true)
    setError('')
    setStatus(null)
    try {
      setStatus({ ...(await action(albumId)), label })
    } catch (err) {
      const data = err.response?.data
      const albums = data?.availableAlbums
      setError(
        (data?.error || err.message || 'No se pudo conectar con YouTube') +
        (albums?.length ? ` — el canal sí tiene: ${albums.slice(0, 12).join(', ')}` : '')
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-rock-border pt-3 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => run(linkAlbumToYoutube, 'link')}
          disabled={busy}
          className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-50"
        >
          Vincular con YouTube
        </button>
        {artist?.id && (
          <button
            onClick={() => run(() => linkArtistDiscography(artist.id), 'discography')}
            disabled={busy}
            className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-50"
          >
            Vincular discografía completa
          </button>
        )}
        <button
          onClick={() => run(refreshYoutubeViews, 'refresh')}
          disabled={busy}
          className="text-xs text-gray-500 hover:text-rock-accent disabled:opacity-50"
        >
          Refrescar reproducciones
        </button>
      </div>

      {busy && <p className="text-gray-500 text-xs">Consultando YouTube...</p>}
      {error && <p className="text-red-400 text-xs">{error}</p>}

      {status?.label === 'link' && (
        <div className="text-xs space-y-1">
          <p className="text-gray-400">
            {status.matched} de {status.total} temas vinculados
            {!status.channelWasCached && ' (canal del artista resuelto y guardado)'}
          </p>
          {status.partial > 0 && (
            <p className="text-gray-600">{status.partial} por coincidencia parcial de título</p>
          )}
          {status.unmatched?.length > 0 && (
            <p className="text-gray-600">Sin match: {status.unmatched.join(', ')}</p>
          )}
          {status.top?.length > 0 && (
            <div className="pt-1">
              <p className="text-gray-500">Más escuchados:</p>
              {status.top.map(t => (
                <p key={t.title} className="text-gray-400">
                  {t.title} — {t.views?.toLocaleString('es-AR')}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {status?.label === 'discography' && (
        <div className="text-xs space-y-1">
          {status.skipped ? (
            <p className="text-gray-400">No se pudo: {status.skipped}</p>
          ) : (
            <>
              <p className="text-gray-400">
                {status.albums?.filter(a => a.matched).length} de {status.albums?.length} álbumes vinculados
                {status.albums?.some(a => a.ingested) &&
                  ` · ${status.albums.filter(a => a.ingested).length} con tracks recién traídos de Spotify`}
              </p>
              {status.albums?.filter(a => a.skipped).map(a => (
                <p key={a.album} className="text-gray-600">{a.album}: {a.skipped}</p>
              ))}
            </>
          )}
        </div>
      )}

      {status?.label === 'refresh' && (
        <p className="text-gray-400 text-xs">{status.updated} temas actualizados</p>
      )}
    </div>
  )
}

/**
 * Buscador de discos y de canciones. Arranca vacío: muestra resultados recién al
 * ejecutar la consulta.
 *
 * Las dos búsquedas viven en el mismo panel y no en dos: quien arma una
 * colección elige qué está juntando, y una lista puede mezclar discos y temas.
 * Cambia qué se busca, no dónde se busca.
 */
export function AlbumSearchPanel({ collection, section = null, entries, isRanking = false }) {
  const [mode, setMode] = useState('album')
  const [form, setForm] = useState({
    ...EMPTY_ALBUM_FILTERS,
    yearFrom: section?.year_from ?? '',
    yearTo: section?.year_to ?? '',
  })
  const [filters, setFilters] = useState(null)

  const scope = { sectionId: section?.id ?? null, collectionId: collection.id }
  const albumQuery = useAlbumSearch(scope, filters, !!filters && mode === 'album')
  const trackQuery = useTrackSearch(scope, filters, !!filters && mode === 'track')

  const isTrackMode = mode === 'track'
  const { data: results = [], isLoading, error } = isTrackMode ? trackQuery : albumQuery

  const { createEntry } = useCollectionAdmin()
  const [addError, setAddError] = useState('')

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const search = (e) => {
    e.preventDefault()
    setFilters({ ...form })
  }

  const reset = () => {
    setForm({ ...EMPTY_ALBUM_FILTERS, yearFrom: section?.year_from ?? '', yearTo: section?.year_to ?? '' })
    setFilters(null)
  }

  const add = (item) => {
    // Una canción se ubica en el tiempo por la fecha de su disco: no tiene una
    // propia.
    const album = isTrackMode ? item.album : item

    createEntry.mutate(
      {
        collection_id: collection.id,
        section_id: section?.id ?? null,
        entry_type: isTrackMode ? 'track' : 'album',
        ...(isTrackMode ? { track_id: item.id } : { album_id: item.id }),
        // Con épocas, cada año tiene su propio orden. Sin épocas hay una sola
        // secuencia y lo nuevo va al final, que es donde el editor lo espera.
        position: section
          ? nextPositionInYear(entries, albumYear(album))
          : nextPosition(entries),
        // Un disco nuevo entra último en el ranking. Sin puesto quedaría como
        // "—" hasta que alguien se acuerde de numerarlo a mano.
        ...(isRanking && { rank: entries.length + 1 }),
      },
      {
        onSuccess: () => setAddError(''),
        onError: e => setAddError(describeError(e)),
      }
    )
  }

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-bold text-rock-text">Buscar</h2>
        <div className="flex gap-1 bg-rock-dark border border-rock-border rounded-lg p-1">
          {[
            { value: 'album', label: 'Discos' },
            { value: 'track', label: 'Canciones' },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setMode(value); setFilters(null) }}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                mode === value ? 'bg-rock-accent text-white' : 'text-gray-400 hover:text-rock-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={search} className="space-y-2">
        <input
          value={form.title}
          onChange={set('title')}
          placeholder={isTrackMode ? 'Título de la canción' : 'Título del disco'}
          className={`w-full ${INPUT}`}
        />
        <input value={form.artist} onChange={set('artist')} placeholder="Banda" className={`w-full ${INPUT}`} />
        <div className="flex gap-2">
          <input value={form.yearFrom} onChange={set('yearFrom')} placeholder="Desde" type="number" className={`w-1/2 ${INPUT}`} />
          <input value={form.yearTo} onChange={set('yearTo')} placeholder="Hasta" type="number" className={`w-1/2 ${INPUT}`} />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={form.studioOnly}
            onChange={e => setForm({ ...form, studioOnly: e.target.checked })}
            className="accent-rock-accent"
          />
          Sólo álbumes de estudio
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90"
          >
            Buscar
          </button>
          {filters && (
            <button type="button" onClick={reset} className="text-xs text-gray-500 hover:text-rock-text">
              Limpiar
            </button>
          )}
        </div>
      </form>

      {addError && <p className="text-red-400 text-sm">{addError}</p>}
      {error && <p className="text-red-400 text-sm">{describeError(error)}</p>}

      {!filters ? (
        <p className="text-gray-600 text-xs border-t border-rock-border pt-3">
          Los años vienen del rango de la época. Ajustá los filtros y tocá Buscar.
        </p>
      ) : isLoading ? (
        <p className="text-gray-500 text-sm border-t border-rock-border pt-3">Buscando...</p>
      ) : results.length === 0 ? (
        <p className="text-gray-500 text-sm border-t border-rock-border pt-3">
          Sin resultados. Si falta una banda, buscala primero en la app para que se ingeste.
        </p>
      ) : (
        <div className="border-t border-rock-border pt-3 space-y-1 max-h-[28rem] overflow-y-auto">
          <p className="text-gray-600 text-xs">{results.length} resultados</p>
          {results.map(a => {
            // La portada, la banda y la fecha de una canción son las de su disco.
            const cover = isTrackMode ? a.album : a
            return (
            <div key={a.id} className="flex items-center gap-2 py-1">
              <div className="w-9 h-9 rounded overflow-hidden bg-rock-dark flex-shrink-0">
                {cover?.cover_url ? (
                  <img src={cover.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm">
                    {isTrackMode ? '🎵' : '💿'}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-rock-text text-sm truncate">{a.title}</p>
                <p className="text-gray-500 text-xs truncate">
                  {cover?.artist?.name}
                  {isTrackMode && cover?.title ? ` · ${cover.title}` : ''}
                  {cover?.release_date ? ` · ${formatReleaseDate(cover)}` : ''}
                </p>
              </div>
              <button
                onClick={() => add(a)}
                disabled={createEntry.isPending}
                className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-50 flex-shrink-0"
              >
                +
              </button>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function NewNarrativeForm({ collection, section = null, entries, isRanking = false }) {
  const { createEntry } = useCollectionAdmin()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', year: '', body: '', image_url: '' })
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    if (!form.body.trim()) return
    const year = form.year ? Number(form.year) : null
    createEntry.mutate(
      {
        collection_id: collection.id,
        section_id: section?.id ?? null,
        entry_type: 'narrative',
        title: form.title.trim() || null,
        year,
        image_url: form.image_url.trim() || null,
        body_text: form.body.trim(),
        position: section ? nextPositionInYear(entries, year) : nextPosition(entries),
        ...(isRanking && { rank: entries.length + 1 }),
      },
      {
        onSuccess: () => {
          setForm({ title: '', year: '', body: '', image_url: '' })
          setError('')
          setOpen(false)
        },
        onError: (err) => setError(describeError(err)),
      }
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-gray-500 hover:text-rock-accent">
        + Agregar bloque de texto
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <h3 className="font-bold text-rock-text text-sm">Bloque de texto</h3>
      <p className="text-gray-600 text-xs">
        Para hitos sin disco asociado. El año lo ubica en la cronología.
      </p>
      <div className="flex gap-2">
        <input value={form.title} onChange={set('title')} placeholder="Título (opcional)" className={`flex-1 ${INPUT}`} />
        <input value={form.year} onChange={set('year')} placeholder="Año" type="number" className={`w-24 ${INPUT}`} />
      </div>
      <textarea value={form.body} onChange={set('body')} placeholder="Texto" rows={3} className={`w-full ${INPUT}`} />
      <ImageField
        value={form.image_url}
        onChange={url => setForm(f => ({ ...f, image_url: url }))}
        folder="entries"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={createEntry.isPending || !form.body.trim()}
          className="bg-rock-accent text-white px-4 py-1.5 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Agregar bloque
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-rock-text">
          Cancelar
        </button>
      </div>
    </form>
  )
}

