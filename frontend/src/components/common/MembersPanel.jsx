import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfirm } from './ConfirmDialog'
import {
  describeError,
  formatPeriod,
  groupByBand,
  groupByPerson,
  isFeatured,
  roleLabel,
  useBandMembers,
  useCreateMember,
  useDeleteMember,
  useDeletePerson,
  useInvalidateMembers,
  useMemberTrajectory,
  useRenameMember,
  useUpdateMember,
} from '../../hooks/useArtistMembers'
import { useInvalidateCatalog } from '../../hooks/useCatalogAdmin'
import { importArtistMembers } from '../../services/api'
import { timeAgo } from '../../services/dates'

const INPUT = 'bg-rock-dark border border-rock-border rounded px-2 py-1 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent'

/** Los roles se editan como texto separado por comas: es un array en la base. */
const rolesToText = (roles) => (roles || []).join(', ')
const textToRoles = (text) => text.split(',').map(r => r.trim()).filter(Boolean)

/**
 * Los campos de una etapa. Sin el nombre: el nombre es del músico y vive en el
 * encabezado, porque está repetido en todas sus filas.
 */
function StageFields({ stage }) {
  const update = useUpdateMember()
  const remove = useDeleteMember()
  const confirm = useConfirm()
  const [form, setForm] = useState({
    roles: rolesToText(stage.roles),
    year_from: stage.year_from ?? '',
    year_to: stage.year_to ?? '',
    is_original: stage.is_original,
    ended: stage.ended,
    notes: stage.notes || '',
  })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const set = (key, value) => {
    setSaved(false)
    setForm({ ...form, [key]: value })
  }

  const patch = {}
  const roles = textToRoles(form.roles)
  if (roles.join('|') !== (stage.roles || []).join('|')) patch.roles = roles
  const from = form.year_from ? Number(form.year_from) : null
  if (from !== (stage.year_from ?? null)) patch.year_from = from
  const to = form.year_to ? Number(form.year_to) : null
  if (to !== (stage.year_to ?? null)) patch.year_to = to
  if (form.is_original !== stage.is_original) patch.is_original = form.is_original
  if (form.ended !== stage.ended) patch.ended = form.ended
  if (form.notes.trim() !== (stage.notes || '')) patch.notes = form.notes.trim() || null

  const dirty = Object.keys(patch).length > 0

  const save = () => {
    update.mutate(
      { id: stage.id, manual_fields: stage.manual_fields, ...patch },
      { onSuccess: () => { setError(''); setSaved(true) }, onError: e => setError(describeError(e)) }
    )
  }

  return (
    <div className="py-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={form.year_from}
          onChange={e => set('year_from', e.target.value)}
          type="number"
          placeholder="Desde"
          className={`w-20 ${INPUT}`}
        />
        <span className="text-gray-600 text-xs">–</span>
        <input
          value={form.year_to}
          onChange={e => set('year_to', e.target.value)}
          type="number"
          placeholder="Hasta"
          className={`w-20 ${INPUT}`}
        />
        <label className="flex items-center gap-1 text-xs text-gray-400">
          <input type="checkbox" checked={form.is_original} onChange={e => set('is_original', e.target.checked)} />
          original
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-400">
          <input type="checkbox" checked={form.ended} onChange={e => set('ended', e.target.checked)} />
          ya no está
        </label>

        <button
          onClick={save}
          disabled={!dirty || update.isPending}
          className="ml-auto bg-rock-accent text-white px-3 py-1 rounded text-xs font-semibold hover:opacity-90 disabled:opacity-30"
        >
          Guardar
        </button>
        {saved && <span className="text-xs text-gray-500">Guardado</span>}
        <button
          onClick={async () => {
            const ok = await confirm({
              title: 'Quitar etapa',
              message: `¿Quitar la etapa ${formatPeriod(stage)}?`,
              confirmLabel: 'Quitar',
            })
            if (ok) remove.mutate(stage.id, { onError: e => setError(describeError(e)) })
          }}
          title="Quitar sólo esta etapa"
          className="text-gray-600 hover:text-red-400 text-xs"
        >
          ✕
        </button>
      </div>

      <input
        value={form.roles}
        onChange={e => set('roles', e.target.value)}
        placeholder="guitarra, voz, teclados"
        className={`w-full ${INPUT}`}
      />

      <input
        value={form.notes}
        onChange={e => set('notes', e.target.value)}
        placeholder="Nota interna (opcional)"
        className={`w-full ${INPUT}`}
      />

      {stage.manual_fields?.length > 0 && (
        <p className="text-rock-accent text-[11px]">
          {stage.manual_fields.length} campo(s) editado(s): la importación no los toca.
        </p>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

/** El nombre del músico, editable sólo cuando es lo único que lo identifica. */
function MemberName({ person }) {
  const rename = useRenameMember()
  const [value, setValue] = useState(person.name)
  const [error, setError] = useState('')

  // Con id de MusicBrainz o ficha en el catálogo, el nombre viene de ahí:
  // editarlo acá dejaría a la misma persona con un nombre en la formación y
  // otro en su página, y la próxima importación lo devolvería igual. Los
  // cargados a mano no tienen otra identidad que el texto, así que ésos sí.
  if (person.memberMbId || person.slug) {
    return <span className="text-rock-text font-medium">{person.name}</span>
  }

  const dirty = value.trim() !== person.name && value.trim().length > 0

  return (
    <span className="flex items-center gap-2">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        className={`w-56 ${INPUT}`}
      />
      <button
        onClick={() => rename.mutate(
          {
            ids: person.stages.map(s => s.id),
            name: value.trim(),
            manualFieldsById: Object.fromEntries(person.stages.map(s => [s.id, s.manual_fields])),
          },
          { onError: e => setError(describeError(e)) }
        )}
        disabled={!dirty || rename.isPending}
        className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-30"
      >
        Renombrar
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </span>
  )
}

/** Suma otra etapa al mismo músico: se fue y volvió. */
function AddStage({ person, groupId }) {
  const create = useCreateMember()
  const [error, setError] = useState('')

  return (
    <div className="pt-2">
      <button
        onClick={() => create.mutate(
          {
            group_id: groupId,
            member_id: person.stages[0]?.member_id || null,
            member_mb_id: person.memberMbId,
            member_name: person.name,
            roles: [],
          },
          { onError: e => setError(describeError(e)) }
        )}
        disabled={create.isPending}
        className="text-xs text-gray-500 hover:text-rock-accent disabled:opacity-50"
      >
        + Agregar etapa
      </button>
      {error && <span className="text-red-400 text-xs ml-2">{error}</span>}
    </div>
  )
}

/**
 * Un músico: colapsado ocupa tres líneas, y al abrirlo se editan todas sus
 * etapas juntas.
 *
 * La edición sigue siendo por etapa —es la fila que existe en la base— pero
 * abrir una a la vez obligaba a entrar y salir tres veces para arreglar a
 * alguien que entró, se fue y volvió.
 */
function PersonBlock({ person, groupId, editingKey, setEditingKey }) {
  const removePerson = useDeletePerson()
  const confirm = useConfirm()
  const [error, setError] = useState('')
  const open = editingKey === person.key

  // Sólo los que ya están en el catálogo tienen panel propio que editar.
  const catalogId = person.stages.find(s => s.member_id)?.member_id || null

  const remove = async () => {
    const ok = await confirm({
      title: 'Quitar integrante',
      message: person.stages.length === 1
        ? `¿Quitar a "${person.name}" de la formación?`
        : `¿Quitar a "${person.name}" y sus ${person.stages.length} etapas?`,
      confirmLabel: 'Quitar',
    })
    if (!ok) return
    removePerson.mutate(
      person.stages.map(s => s.id),
      { onSuccess: () => setEditingKey(null), onError: e => setError(describeError(e)) }
    )
  }

  return (
    <div className="py-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        {open ? <MemberName person={person} /> : (
          <span className="text-rock-text font-medium">{person.name}</span>
        )}

        {person.isOriginal && (
          <span className="text-[10px] uppercase tracking-wide text-rock-accent border border-rock-accent rounded px-1">
            original
          </span>
        )}

        {catalogId ? (
          <span className="flex items-baseline gap-2 ml-auto">
            <Link
              to={`/admin/artista/${catalogId}`}
              className="text-xs border border-rock-border rounded px-2 py-0.5 text-gray-400 hover:text-rock-accent hover:border-rock-accent"
            >
              Editar artista
            </Link>
            <Link
              to={`/artist/${person.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-rock-accent text-xs"
            >
              ficha →
            </Link>
          </span>
        ) : (
          <span className="text-gray-700 text-xs ml-auto">sin ficha</span>
        )}

        <button
          onClick={remove}
          disabled={removePerson.isPending}
          title="Quitar al músico con todas sus etapas"
          className="text-gray-600 hover:text-red-400 text-xs disabled:opacity-50"
        >
          ✕
        </button>
      </div>

      <div className="flex items-baseline gap-3 flex-wrap mt-0.5">
        <span className="text-gray-500 text-xs font-mono">
          {person.periods.map(p => `(${p})`).join(' ')}
        </span>
        <button
          onClick={() => setEditingKey(open ? null : person.key)}
          className="text-xs border border-rock-border rounded px-2 py-0.5 text-gray-400 hover:text-rock-accent hover:border-rock-accent"
        >
          {open ? 'Cerrar' : 'Editar'}
        </button>
      </div>

      {person.roles.length > 0 && !open && (
        <p className="text-gray-500 text-xs mt-0.5">
          {person.roles.map(roleLabel).join(' · ')}
        </p>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {open && (
        <div className="mt-2 pl-3 border-l-2 border-rock-accent divide-y divide-rock-border">
          {person.stages.map(stage => (
            <StageFields key={stage.id} stage={stage} />
          ))}
          <AddStage person={person} groupId={groupId} />
        </div>
      )}
    </div>
  )
}

function NewMemberForm({ groupId }) {
  const create = useCreateMember()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ member_name: '', roles: '', year_from: '', year_to: '' })
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!form.member_name.trim()) return
    create.mutate(
      {
        group_id: groupId,
        member_name: form.member_name.trim(),
        roles: textToRoles(form.roles),
        year_from: form.year_from ? Number(form.year_from) : null,
        year_to: form.year_to ? Number(form.year_to) : null,
      },
      {
        onSuccess: () => {
          setForm({ member_name: '', roles: '', year_from: '', year_to: '' })
          setError('')
          setOpen(false)
        },
        onError: e => setError(describeError(e)),
      }
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-gray-500 hover:text-rock-accent">
        + Agregar integrante a mano
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="bg-rock-dark border border-rock-border rounded p-3 space-y-2">
      <input
        value={form.member_name}
        onChange={e => setForm({ ...form, member_name: e.target.value })}
        placeholder="Nombre del músico"
        className={`w-full ${INPUT}`}
      />
      <div className="flex gap-2 flex-wrap">
        <input
          value={form.year_from}
          onChange={e => setForm({ ...form, year_from: e.target.value })}
          type="number"
          placeholder="Desde"
          className={`w-24 ${INPUT}`}
        />
        <input
          value={form.year_to}
          onChange={e => setForm({ ...form, year_to: e.target.value })}
          type="number"
          placeholder="Hasta"
          className={`w-24 ${INPUT}`}
        />
        <input
          value={form.roles}
          onChange={e => setForm({ ...form, roles: e.target.value })}
          placeholder="guitarra, voz"
          className={`flex-1 min-w-[140px] ${INPUT}`}
        />
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={create.isPending || !form.member_name.trim()}
          className="bg-rock-accent text-white px-3 py-1 rounded text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Agregar
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-rock-text">
          Cancelar
        </button>
      </div>
    </form>
  )
}

/**
 * Formación de la banda: importada de MusicBrainz y corregible a mano.
 *
 * Importar no crea fichas de artista. La mayoría de los integrantes son músicos
 * de sesión sin discografía, y alcanza con nombrarlos: el nombre queda en la
 * fila. Los que ya están en el catálogo se enlazan solos a su ficha.
 */
export default function MembersPanel({ artist }) {
  const { data: members = [] } = useBandMembers(artist.id)
  const { data: trajectory = [] } = useMemberTrajectory(artist.external_mb_id)
  const [editingKey, setEditingKey] = useState(null)
  const [showHelp, setShowHelp] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const invalidate = useInvalidateMembers()
  const invalidateCatalog = useInvalidateCatalog()

  const people = groupByPerson(members)
  const bandsPlayedIn = groupByBand(trajectory)

  // Una banda tiene integrantes; una persona, bandas. `artist_type` puede venir
  // vacío en las fichas cargadas antes de la migración, así que lo que ya está
  // importado también cuenta como evidencia.
  const isBand = artist.artist_type === 'group' || people.length > 0
  const isPerson = artist.artist_type === 'person' || (!isBand && bandsPlayedIn.length > 0)
  // Mismo corte que la página pública: los originales y los que tienen ficha.
  // Si el criterio no destaca a nadie, esconder la lista entera no ayudaría.
  const featured = people.filter(isFeatured)
  const visiblePeople = expanded || featured.length === 0 ? people : featured
  const hiddenCount = people.length - visiblePeople.length

  const runImport = async () => {
    setBusy(true)
    setError('')
    setStatus(null)
    try {
      const result = await importArtistMembers(artist.id)
      setStatus(result)
      invalidate()
      // La marca de última corrida y el tipo viven en `artists`, no en la
      // formación. La marca se escribe siempre, así que el catálogo se
      // invalida siempre: atarlo a que el tipo hubiera cambiado dejaba la
      // fecha vieja en pantalla en toda reimportación.
      invalidateCatalog()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo conectar con MusicBrainz')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-bold text-rock-text text-sm">
          {isPerson ? 'Bandas' : 'Formación'}
        </h2>
        {people.length > 0 && (
          <span className="text-gray-600 text-xs">
            {people.length} músicos · {members.length} etapas
          </span>
        )}
        <span
          className="text-gray-600 text-xs"
          title={artist.members_imported_at ? new Date(artist.members_imported_at).toLocaleString('es-AR') : ''}
        >
          {artist.members_imported_at ? timeAgo(artist.members_imported_at) : 'nunca importado'}
        </span>
        <button
          onClick={runImport}
          disabled={busy || !artist.external_mb_id}
          title={artist.external_mb_id ? '' : 'Este artista no está vinculado a MusicBrainz'}
          className="ml-auto text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-50"
        >
          {busy ? 'Consultando...' : 'Importar de MusicBrainz'}
        </button>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="text-gray-600 hover:text-rock-accent text-xs"
        >
          ?
        </button>
      </div>

      {showHelp && (
        <div className="text-gray-600 text-xs space-y-1 border-l-2 border-rock-border pl-3">
          <p>
            Una etapa por paso: quien entró, se fue y volvió tiene varias, y se
            editan todas juntas abriendo al músico.
          </p>
          <p>
            Importar se puede repetir. Actualiza lo que ya está en vez de
            duplicarlo, y no toca los campos que hayas corregido a mano.
          </p>
          <p>
            No crea fichas de artista: los músicos que no están en el catálogo
            quedan como nombre y se ven igual en su trayectoria.
          </p>
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {status && (
        <div className="text-xs space-y-1">
          <p className="text-gray-400">
            {status.saved === 0
              ? 'MusicBrainz no tiene formaciones cargadas para este artista.'
              : `${status.saved} ${status.saved === 1 ? 'etapa' : 'etapas'} de ${status.people} ${status.people === 1 ? 'músico' : 'músicos'} · ${status.linked} con ficha en el catálogo`}
          </p>
          {status.artistType && (
            <p className="text-gray-600">
              Tipo completado desde MusicBrainz:{' '}
              {status.artistType === 'group' ? 'banda' : status.artistType === 'person' ? 'músico' : 'otro'}.
            </p>
          )}
          {status.skipped > 0 && (
            <p className="text-gray-600">
              {status.skipped} salteadas: son bandas que todavía no están en el
              catálogo. Cargalas y volvé a importar.
            </p>
          )}
        </div>
      )}

      {people.length > 0 && (
        <div>
          <div className="divide-y divide-rock-border border-y border-rock-border">
            {visiblePeople.map(p => (
              <PersonBlock
                key={p.key}
                person={p}
                groupId={artist.id}
                editingKey={editingKey}
                setEditingKey={setEditingKey}
              />
            ))}
          </div>
          {(hiddenCount > 0 || expanded) && featured.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-500 hover:text-rock-accent text-xs py-2"
            >
              {expanded
                ? 'Ver menos'
                : `Ver los otros ${hiddenCount} ${hiddenCount === 1 ? 'músico' : 'músicos'}`}
            </button>
          )}
        </div>
      )}

      {isPerson ? (
        <p className="text-gray-600 text-xs">
          Para sumarlo a una banda entrá a la ficha de esa banda: la etapa vive
          del lado del grupo, no del músico.
        </p>
      ) : (
        <NewMemberForm groupId={artist.id} />
      )}

      {/*
        La otra dirección: en qué bandas tocó este artista. No se edita acá
        porque la fila vive del lado del grupo —`group_id` es la banda— así que
        cada una enlaza a su editor.
      */}
      {bandsPlayedIn.length > 0 && (
        <div className={isPerson ? '' : 'pt-3 border-t border-rock-border'}>
          {!isPerson && (
            <h3 className="text-gray-400 text-xs font-semibold mb-1">
              Tocó en ({bandsPlayedIn.length})
            </h3>
          )}
          <div className="divide-y divide-rock-border border-y border-rock-border">
            {bandsPlayedIn.map(band => (
              <div key={band.key} className="flex items-baseline gap-3 py-2 flex-wrap text-xs">
                <span className="text-rock-text text-sm font-medium">{band.name}</span>
                {band.roles.length > 0 && (
                  <span className="text-gray-500">{band.roles.map(roleLabel).join(' · ')}</span>
                )}
                <span className="text-gray-600 font-mono">
                  {band.periods.map(p => `(${p})`).join(' ')}
                </span>
                <Link
                  to={`/admin/artista/${band.key}`}
                  className="ml-auto border border-rock-border rounded px-2 py-0.5 text-gray-400 hover:text-rock-accent hover:border-rock-accent"
                >
                  Editar en {band.name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
