import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useConfirm } from '../components/common/ConfirmDialog'
import ImageField from '../components/common/ImageField'
import PlaylistField from '../components/common/PlaylistField'
import {
  AlbumSearchPanel,
  EntriesByYear,
  EntryEditor,
  NewNarrativeForm,
} from '../components/common/CollectionEntryEditor'
import RequireCollectionOwner from '../components/common/RequireCollectionOwner'
import {
  describeError,
  EMPTY_ALBUM_FILTERS,
  useAlbumSearch,
  useCollectionAdmin,
} from '../hooks/useCollectionAdmin'
import { groupEntriesByYear, nextPositionInYear, useCollectionSection } from '../hooks/useCollections'
import { albumYear, formatReleaseDate } from '../services/dates'
import { linkAlbumToYoutube, linkArtistDiscography, refreshYoutubeViews } from '../services/api'
import { SkeletonPanel } from '../components/common/States'
import ArrowLink from '../components/common/ArrowLink'
import { IconChevronRight } from '../components/common/Icons'

const LABEL = 'block text-[13px] text-gray-400 mb-1.5'

// Un campo de año no acepta signo, exponente ni decimales.
const blockNonDigits = (e) => {
  if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault()
}

/**
 * Los datos de la época.
 *
 * Plegados por defecto: a esta pantalla se viene a cargar discos, y el
 * formulario abierto empujaba la lista de entradas fuera de la vista. Plegado
 * muestra igual lo importante —años, subtítulo, si tiene portada y playlist—, así
 * que se ve qué falta sin abrirlo.
 */
function SectionFields({ section }) {
  const { updateSection } = useCollectionAdmin()
  const initial = () => ({
    title: section.title,
    subtitle: section.subtitle || '',
    intro_text: section.intro_text || '',
    cover_url: section.cover_url || '',
    playlist_url: section.playlist_url || '',
    year_from: section.year_from ?? '',
    year_to: section.year_to ?? '',
  })
  const [form, setForm] = useState(initial)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const set = (key) => (e) => { setSaved(false); setForm({ ...form, [key]: e.target.value }) }
  const setValue = (key) => (value) => { setSaved(false); setForm(f => ({ ...f, [key]: value })) }

  const save = () => {
    updateSection.mutate(
      {
        id: section.id,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        intro_text: form.intro_text.trim() || null,
        cover_url: form.cover_url.trim() || null,
        playlist_url: form.playlist_url.trim() || null,
        year_from: form.year_from ? Number(form.year_from) : null,
        year_to: form.year_to ? Number(form.year_to) : null,
      },
      { onSuccess: () => { setError(''); setSaved(true) }, onError: e => setError(describeError(e)) }
    )
  }

  // Plegar no descarta nada: lo escrito sigue ahí al volver a abrir, y el
  // resumen avisa que hay cambios sin guardar.
  const saved0 = initial()
  const dirty = Object.keys(saved0).some(k => String(form[k]) !== String(saved0[k]))

  const years = [section.year_from, section.year_to].filter(Boolean).join('–')
  const summary = [
    years || 'Sin años',
    section.subtitle || null,
    section.cover_url ? 'con portada' : 'sin portada',
    section.playlist_url ? 'con playlist' : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="card space-y-4">
      {/* El encabezado entero abre y cierra: es un plegable, y la flecha lo
          dice. Un "Cancelar" para cerrar se leía como descartar la edición. */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 text-left group"
      >
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl group-hover:text-rock-accent transition-colors">Datos de la época</h2>
          {!open && (
            <p className="text-gray-500 text-[12.5px] mt-0.5 truncate">
              {dirty ? <span className="text-rock-accent">Cambios sin guardar · </span> : null}
              {summary}
            </p>
          )}
        </div>
        <span className={`btn btn-secondary btn-icon flex-none transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>
          <IconChevronRight size={16} />
        </span>
      </button>

      {open && (
        <>
          {/* De a pares en escritorio (título y subtítulo, años y portada);
              playlist y descripción a todo el ancho. En el teléfono, en fila. */}
          <div className="grid gap-4 md:grid-cols-2 items-start">
            <label className="block">
              <span className={LABEL}>Título</span>
              <input value={form.title} onChange={set('title')} className="input" />
            </label>
            <label className="block">
              <span className={LABEL}>Subtítulo</span>
              <input value={form.subtitle} onChange={set('subtitle')} placeholder="Una línea debajo del título" className="input" />
            </label>

            <div>
              <span className={LABEL}>Años</span>
              <div className="flex items-center gap-2.5">
                <input
                  value={form.year_from}
                  onChange={set('year_from')}
                  onKeyDown={blockNonDigits}
                  type="number"
                  inputMode="numeric"
                  placeholder="Desde"
                  aria-label="Desde"
                  className="input !w-28"
                />
                <span className="text-gray-500 text-sm">a</span>
                <input
                  value={form.year_to}
                  onChange={set('year_to')}
                  onKeyDown={blockNonDigits}
                  type="number"
                  inputMode="numeric"
                  placeholder="Hasta"
                  aria-label="Hasta"
                  className="input !w-28"
                />
              </div>
              <span className="block text-[11.5px] text-gray-500 mt-1.5">
                Alimentan las sugerencias de discos del buscador de la derecha.
              </span>
            </div>
            <div>
              <span className={LABEL}>Portada</span>
              <ImageField
                value={form.cover_url}
                onChange={setValue('cover_url')}
                folder="collections"
                placeholder="URL de portada (opcional)"
              />
            </div>

            <div className="md:col-span-2">
              <span className={LABEL}>Playlist</span>
              <PlaylistField value={form.playlist_url} onChange={setValue('playlist_url')} />
            </div>

            <label className="block md:col-span-2">
              <span className={LABEL}>Descripción</span>
              <textarea
                value={form.intro_text}
                onChange={set('intro_text')}
                placeholder="Con qué arranca la época. Una línea en blanco separa párrafos."
                rows={5}
                className="input"
              />
            </label>
          </div>

          {error && <p className="field-error">{error}</p>}

          <div className="flex items-center gap-3 justify-end border-t border-rock-border pt-4">
            {saved && !dirty && <span className="text-xs text-gray-500">Guardado</span>}
            <button onClick={save} disabled={!dirty || updateSection.isPending} className="btn btn-primary px-7">
              Guardar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
export default function AdminSectionEdit() {
  const { slug, sectionSlug } = useParams()
  const { data, isLoading } = useCollectionSection(slug, sectionSlug)
  const [selectedId, setSelectedId] = useState(null)

  const entries = data?.entries || []
  const selected = entries.find(e => e.id === selectedId) || null

  // Si la entrada abierta se borró, cerrar el panel.
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null)
  }, [selectedId, selected])

  return (
    <>
      {isLoading ? (
        <SkeletonPanel />
      ) : !data?.section ? (
        <p className="text-rock-accentBright">Sección no encontrada.</p>
      ) : (
        <RequireCollectionOwner collection={data.collection}>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <ArrowLink back to={`/coleccion/${data.collection.slug}/editar`}>{data.collection.title}</ArrowLink>
            <ArrowLink to={`/coleccion/${data.collection.slug}/${data.section.slug}`} target="_blank" rel="noopener noreferrer" className="ml-auto">Ver la página</ArrowLink>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-3xl sm:text-4xl">{data.section.title}</h1>
            {(data.section.year_from || data.section.year_to) && (
              <span className="tag tag-neutral">
                {[data.section.year_from, data.section.year_to].filter(Boolean).join('–')}
              </span>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Contenido cargado */}
            <div className="flex-1 min-w-0 space-y-6">
              <SectionFields section={data.section} />

              <div>
                <h2 className="font-display text-2xl mb-1">
                  Entradas ({entries.length})
                </h2>
                <p className="text-gray-500 text-[13px] mb-3">
                  Agrupadas por año, en orden cronológico. Elegí una para editarla
                  en el panel de la derecha, o movela con las flechas para fijar
                  el orden dentro de su año.
                </p>
                {entries.length === 0 ? (
                  <p className="text-gray-500 text-sm">Todavía no hay entradas.</p>
                ) : (
                  <EntriesByYear
                    entries={entries}
                    selectedId={selectedId}
                    onSelect={id => setSelectedId(id === selectedId ? null : id)}
                  />
                )}
              </div>

              <NewNarrativeForm collection={data.collection} section={data.section} entries={entries} />
            </div>

            {/* Panel lateral: edición + búsqueda */}
            <aside className="w-full lg:w-96 lg:flex-shrink-0 lg:sticky lg:top-24 space-y-4">
              {selected && (
                <EntryEditor
                  key={selected.id}
                  entry={selected}
                  where="la época"
                  onClose={() => setSelectedId(null)}
                />
              )}
              <AlbumSearchPanel collection={data.collection} section={data.section} entries={entries} />
            </aside>
          </div>
        </div>
        </RequireCollectionOwner>
      )}
    </>
  )
}
