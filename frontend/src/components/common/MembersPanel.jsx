import { useState } from 'react'
import { Link } from 'react-router-dom'
import ManualFieldMark from './ManualFieldMark'
import {
  describeError,
  formatPeriod,
  groupByBand,
  groupByPerson,
  roleLabel,
  useBandMembers,
  useCreateMember,
  useDeleteMember,
  useDeletePerson,
  useMemberTrajectory,
  useUpdateMember,
} from '../../hooks/useArtistMembers'
import { importArtistMembers } from '../../services/api'

const INPUT = 'bg-rock-dark border border-rock-border rounded px-2 py-1 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent'

/** Los roles se editan como texto separado por comas: es un array en la base. */
const rolesToText = (roles) => (roles || []).join(', ')
const textToRoles = (text) => text.split(',').map(r => r.trim()).filter(Boolean)

function StageEditor({ member, onClose }) {
  const update = useUpdateMember()
  const remove = useDeleteMember()
  const [form, setForm] = useState({
    member_name: member.member_name || '',
    roles: rolesToText(member.roles),
    year_from: member.year_from ?? '',
    year_to: member.year_to ?? '',
    is_original: member.is_original,
    ended: member.ended,
    notes: member.notes || '',
  })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const set = (key, value) => {
    setSaved(false)
    setForm({ ...form, [key]: value })
  }

  const patch = {}
  if (form.member_name.trim() !== (member.member_name || '')) patch.member_name = form.member_name.trim()
  const roles = textToRoles(form.roles)
  if (roles.join('|') !== (member.roles || []).join('|')) patch.roles = roles
  const from = form.year_from ? Number(form.year_from) : null
  if (from !== (member.year_from ?? null)) patch.year_from = from
  const to = form.year_to ? Number(form.year_to) : null
  if (to !== (member.year_to ?? null)) patch.year_to = to
  if (form.is_original !== member.is_original) patch.is_original = form.is_original
  if (form.ended !== member.ended) patch.ended = form.ended
  if (form.notes.trim() !== (member.notes || '')) patch.notes = form.notes.trim() || null

  const dirty = Object.keys(patch).length > 0

  const save = () => {
    update.mutate(
      { id: member.id, manual_fields: member.manual_fields, ...patch },
      { onSuccess: () => { setError(''); setSaved(true) }, onError: e => setError(describeError(e)) }
    )
  }

  return (
    <div className="bg-rock-dark border border-rock-accent rounded p-3 space-y-2 my-1">
      <div className="flex items-center gap-2">
        <input
          value={form.member_name}
          onChange={e => set('member_name', e.target.value)}
          placeholder="Nombre del músico"
          className={`flex-1 ${INPUT}`}
        />
        <ManualFieldMark field="member_name" manualFields={member.manual_fields} />
        <button onClick={onClose} className="text-gray-500 hover:text-rock-text text-sm">✕</button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={form.year_from}
          onChange={e => set('year_from', e.target.value)}
          type="number"
          placeholder="Desde"
          className={`w-24 ${INPUT}`}
        />
        <input
          value={form.year_to}
          onChange={e => set('year_to', e.target.value)}
          type="number"
          placeholder="Hasta"
          className={`w-24 ${INPUT}`}
        />
        <label className="flex items-center gap-1 text-xs text-gray-400">
          <input type="checkbox" checked={form.is_original} onChange={e => set('is_original', e.target.checked)} />
          formación original
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-400">
          <input type="checkbox" checked={form.ended} onChange={e => set('ended', e.target.checked)} />
          ya no está
        </label>
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

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || update.isPending}
          className="bg-rock-accent text-white px-3 py-1 rounded text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Guardar
        </button>
        {saved && <span className="text-xs text-gray-500">Guardado</span>}
        <button
          onClick={() => {
            if (!window.confirm(`¿Quitar la etapa de "${member.member_name}"?`)) return
            remove.mutate(member.id, { onSuccess: onClose, onError: e => setError(describeError(e)) })
          }}
          className="ml-auto text-xs text-gray-500 hover:text-red-400"
        >
          Quitar etapa
        </button>
      </div>
    </div>
  )
}

function StageRow({ stage, editingId, setEditingId }) {
  if (editingId === stage.id) {
    return <StageEditor key={stage.id} member={stage} onClose={() => setEditingId(null)} />
  }

  return (
    <div className="flex items-baseline gap-3 py-1 pl-4 flex-wrap text-xs">
      <span className="text-gray-500 font-mono w-24 flex-shrink-0">{formatPeriod(stage)}</span>
      <span className="text-gray-400 flex-1 min-w-0">
        {stage.roles?.length > 0 ? stage.roles.map(roleLabel).join(' · ') : 'sin instrumentos'}
      </span>
      {stage.is_original && <span className="text-rock-accent">original</span>}
      {stage.source === 'manual' && <span className="text-gray-600">a mano</span>}
      {stage.manual_fields?.length > 0 && <span className="text-rock-accent">editado</span>}
      <button
        onClick={() => setEditingId(stage.id)}
        className="border border-rock-border rounded px-2 py-0.5 text-gray-400 hover:text-rock-accent hover:border-rock-accent"
      >
        Editar
      </button>
    </div>
  )
}

/**
 * Un músico con sus etapas anidadas.
 *
 * La edición trabaja por etapa —es la fila que existe en la base— pero la
 * lectura no: veintisiete filas planas dejaban los tres pasos de Charly García
 * separados por quince nombres.
 */
function PersonBlock({ person, editingId, setEditingId }) {
  const removePerson = useDeletePerson()
  const [error, setError] = useState('')

  const remove = () => {
    const label = person.stages.length === 1
      ? `¿Quitar a "${person.name}" de la formación?`
      : `¿Quitar a "${person.name}" y sus ${person.stages.length} etapas?`
    if (!window.confirm(label)) return
    removePerson.mutate(
      person.stages.map(s => s.id),
      { onError: e => setError(describeError(e)) }
    )
  }

  return (
    <div className="py-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-rock-text text-sm font-medium">{person.name}</span>
        <span className="text-gray-600 text-xs font-mono">
          {person.periods.map(p => `(${p})`).join(' ')}
        </span>
        {person.slug ? (
          <Link
            to={`/artist/${person.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-rock-accent text-xs ml-auto"
          >
            ficha →
          </Link>
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

      {error && <p className="text-red-400 text-xs pl-4">{error}</p>}

      {person.stages.map(stage => (
        <StageRow key={stage.id} stage={stage} editingId={editingId} setEditingId={setEditingId} />
      ))}
    </div>
  )
}

/**
 * Cuántos músicos se listan sin desplegar.
 *
 * Corte por cantidad y no por importancia como en la página pública: acá el
 * trabajo suele ser justamente corregir a los oscuros, así que esconderlos por
 * criterio sería trabajar en contra.
 */
const ADMIN_PREVIEW = 8

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
  const [editingId, setEditingId] = useState(null)
  const [showHelp, setShowHelp] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const people = groupByPerson(members)
  const bandsPlayedIn = groupByBand(trajectory)
  const visiblePeople = expanded ? people : people.slice(0, ADMIN_PREVIEW)

  const runImport = async () => {
    setBusy(true)
    setError('')
    setStatus(null)
    try {
      setStatus(await importArtistMembers(artist.id))
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo conectar con MusicBrainz')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-rock-card border border-rock-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-bold text-rock-text text-sm">Formación</h2>
        {people.length > 0 && (
          <span className="text-gray-600 text-xs">
            {people.length} músicos · {members.length} etapas
          </span>
        )}
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
            Una fila por músico y etapa: quien entró, se fue y volvió tiene una
            etapa por cada paso.
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
              : `${status.saved} etapas de ${status.people} músicos · ${status.linked} con ficha en el catálogo`}
          </p>
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
              <PersonBlock key={p.key} person={p} editingId={editingId} setEditingId={setEditingId} />
            ))}
          </div>
          {people.length > ADMIN_PREVIEW && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-500 hover:text-rock-accent text-xs py-2"
            >
              {expanded
                ? 'Ver menos'
                : `Ver los otros ${people.length - ADMIN_PREVIEW} músicos`}
            </button>
          )}
        </div>
      )}

      <NewMemberForm groupId={artist.id} />

      {/*
        La otra dirección: en qué bandas tocó este artista. Se edita desde la
        ficha de cada banda, que es donde vive la fila.
      */}
      {bandsPlayedIn.length > 0 && (
        <div className="pt-3 border-t border-rock-border">
          <h3 className="text-gray-400 text-xs font-semibold mb-1">
            Tocó en ({bandsPlayedIn.length})
          </h3>
          {bandsPlayedIn.map(band => (
            <div key={band.key} className="flex items-baseline gap-3 py-1 flex-wrap text-xs">
              <Link to={`/admin/artista/${band.key}`} className="text-gray-300 hover:text-rock-accent">
                {band.name}
              </Link>
              {band.roles.length > 0 && (
                <span className="text-gray-600">{band.roles.map(roleLabel).join(' · ')}</span>
              )}
              <span className="text-gray-600 font-mono ml-auto">
                {band.periods.map(p => `(${p})`).join(' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
