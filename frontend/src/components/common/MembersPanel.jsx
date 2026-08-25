import { useState } from 'react'
import { Link } from 'react-router-dom'
import ManualFieldMark from './ManualFieldMark'
import {
  describeError,
  formatPeriod,
  roleLabel,
  useBandMembers,
  useCreateMember,
  useDeleteMember,
  useMemberTrajectory,
  useUpdateMember,
} from '../../hooks/useArtistMembers'
import { importArtistMembers } from '../../services/api'

const INPUT = 'bg-rock-dark border border-rock-border rounded px-2 py-1 text-sm text-rock-text placeholder-gray-500 focus:outline-none focus:border-rock-accent'

/** Los roles se editan como texto separado por comas: es un array en la base. */
const rolesToText = (roles) => (roles || []).join(', ')
const textToRoles = (text) =>
  text.split(',').map(r => r.trim()).filter(Boolean)

function MemberEditor({ member, onClose }) {
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
    <div className="bg-rock-dark border border-rock-accent rounded p-3 space-y-2">
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
            if (!window.confirm(`¿Quitar a "${member.member_name}" de la formación?`)) return
            remove.mutate(member.id, { onSuccess: onClose, onError: e => setError(describeError(e)) })
          }}
          className="ml-auto text-xs text-gray-500 hover:text-red-400"
        >
          Quitar
        </button>
      </div>
    </div>
  )
}

function MemberRow({ member, editingId, setEditingId }) {
  if (editingId === member.id) {
    return <MemberEditor key={member.id} member={member} onClose={() => setEditingId(null)} />
  }

  return (
    <div className="flex items-center gap-3 py-2 flex-wrap">
      <span className="text-gray-500 text-xs font-mono w-28 flex-shrink-0">
        {formatPeriod(member)}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-rock-text text-sm">{member.member_name}</span>
        {member.is_original && <span className="text-rock-accent text-xs"> · original</span>}
        {member.source === 'manual' && <span className="text-gray-600 text-xs"> · a mano</span>}
        {member.manual_fields?.length > 0 && (
          <span className="text-rock-accent text-xs"> · editado</span>
        )}
        {member.roles?.length > 0 && (
          <p className="text-gray-500 text-xs">{member.roles.map(roleLabel).join(' · ')}</p>
        )}
      </div>
      {member.member?.slug && (
        <Link
          to={`/artist/${member.member.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-rock-accent text-xs"
        >
          ficha →
        </Link>
      )}
      <button
        onClick={() => setEditingId(member.id)}
        className="text-xs border border-rock-border rounded px-2 py-0.5 text-gray-400 hover:text-rock-accent hover:border-rock-accent"
      >
        Editar
      </button>
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
  const [editingId, setEditingId] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
      <div>
        <h2 className="font-bold text-rock-text text-sm">Formación ({members.length})</h2>
        <p className="text-gray-600 text-xs mt-1">
          Una fila por músico y etapa. Importar se puede repetir: actualiza lo que
          ya está en vez de duplicarlo, y respeta lo que hayas corregido a mano.
        </p>
        <p className="text-gray-600 text-xs mt-1">
          No crea fichas: los músicos que no están en el catálogo quedan como
          nombre y se pueden ver igual en su trayectoria.
        </p>
      </div>

      <button
        onClick={runImport}
        disabled={busy || !artist.external_mb_id}
        title={artist.external_mb_id ? '' : 'Este artista no está vinculado a MusicBrainz'}
        className="text-xs border border-rock-border rounded px-2 py-1 text-gray-400 hover:text-rock-accent hover:border-rock-accent disabled:opacity-50"
      >
        Importar de MusicBrainz
      </button>

      {busy && <p className="text-gray-500 text-xs">Consultando MusicBrainz...</p>}
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
              {status.skipped} etapas salteadas: son bandas que todavía no están
              en el catálogo. Cargalas y volvé a importar.
            </p>
          )}
        </div>
      )}

      {members.length > 0 && (
        <div className="divide-y divide-rock-border">
          {members.map(m => (
            <MemberRow key={m.id} member={m} editingId={editingId} setEditingId={setEditingId} />
          ))}
        </div>
      )}

      <NewMemberForm groupId={artist.id} />

      {/*
        La otra dirección: en qué bandas tocó este artista. Se edita desde la
        ficha de cada banda, que es donde vive la fila.
      */}
      {trajectory.length > 0 && (
        <div className="pt-2 border-t border-rock-border">
          <h3 className="text-gray-400 text-xs font-semibold mb-1">
            Tocó en ({trajectory.length})
          </h3>
          {trajectory.map(stage => (
            <div key={stage.id} className="flex items-baseline gap-3 py-1 flex-wrap text-xs">
              <span className="text-gray-500 font-mono w-28 flex-shrink-0">
                {formatPeriod(stage)}
              </span>
              <Link
                to={`/admin/artista/${stage.group?.id}`}
                className="text-gray-300 hover:text-rock-accent"
              >
                {stage.group?.name}
              </Link>
              {stage.roles?.length > 0 && (
                <span className="text-gray-600">{stage.roles.map(roleLabel).join(' · ')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
