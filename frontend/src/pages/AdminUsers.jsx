import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AdminLayout from '../components/common/AdminLayout'
import { useConfirm } from '../components/common/ConfirmDialog'
import RowMenu from '../components/common/RowMenu'
import { EmptyState, SkeletonRows } from '../components/common/States'
import { IconSearch } from '../components/common/Icons'
import { ROLE_LABEL, useRole } from '../hooks/useRole'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'

const ROLES = ['user', 'editor', 'admin']

// Qué puede hacer cada rol, para el menú: cambiar un rol a ciegas es fácil de
// hacer sin querer, y la línea chica dice qué se está dando o quitando.
const ROLE_HINT = {
  user: 'Sin permisos de edición.',
  editor: 'Edita el catálogo y las colecciones.',
  admin: 'Todo lo del editor, más los roles de la gente.',
}

const ROLE_PLURAL = { user: 'Usuarios', editor: 'Editores', admin: 'Admins' }

const TAG = 'tag !text-[10.5px] !py-0.5'
const ROLE_TAG = { admin: 'tag-accent', editor: 'tag-outline', user: 'tag-neutral' }

const joined = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : null

function UserRow({ u, isSelf, busy, onRole }) {
  const confirm = useConfirm()
  const role = u.role || 'user'

  const change = async (next) => {
    // Dar admin es lo único que no se deshace solo: quien lo recibe puede
    // sacarle el rol a los demás.
    if (next === 'admin') {
      const ok = await confirm({
        title: 'Hacer admin',
        message: `${u.username} va a poder cambiar los roles de cualquiera, incluido el tuyo.`,
        confirmLabel: 'Hacer admin',
      })
      if (!ok) return
    }
    onRole({ id: u.id, role: next })
  }

  return (
    <div className="flex items-center gap-4 px-4 sm:px-5 py-3.5 border-t border-rock-border first:border-t-0">
      <div className="w-11 h-11 flex-none rounded-full overflow-hidden bg-rock-accent/20 border border-rock-accentDim
                      grid place-items-center text-rock-accentBright text-sm font-bold">
        {u.avatar_url
          ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
          : u.username?.[0]?.toUpperCase() ?? '?'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/user/${u.username}`} className="text-[15px] font-semibold hover:text-rock-accent">
            {u.username}
          </Link>
          {role !== 'user' && <span className={`${TAG} ${ROLE_TAG[role]}`}>{ROLE_LABEL[role]}</span>}
          {isSelf && <span className={`${TAG} tag-neutral`}>Vos</span>}
        </div>
        <p className="text-gray-500 text-[12.5px] mt-0.5 truncate">
          {[u.email, joined(u.created_at) && `se sumó el ${joined(u.created_at)}`].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* El propio rol no se toca: un admin que se baja a sí mismo por error
          puede dejar el sitio sin nadie que lo arregle. */}
      {!isSelf && (
        <RowMenu
          label="Cambiar rol"
          disabled={busy}
          items={ROLES.filter(r => r !== role).map(r => ({
            label: `Pasar a ${ROLE_LABEL[r].toLowerCase()}`,
            hint: ROLE_HINT[r],
            onClick: () => change(r),
            danger: r === 'user' && role !== 'user',
          }))}
        />
      )}
    </div>
  )
}

export default function AdminUsers() {
  const { isAdmin } = useRole()
  const { user: currentUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [term, setTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('id, username, email, role, avatar_url, created_at')
        .order('created_at', { ascending: true })
      return data || []
    },
    enabled: isAdmin,
  })

  const { mutate: changeRole, isPending } = useMutation({
    mutationFn: async ({ id, role }) => {
      const { error } = await supabase.from('users').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setError('')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (e) => setError(e.message || 'No se pudo cambiar el rol.'),
  })

  if (!isAdmin) {
    return (
      <EmptyState
        title="Esta sección es de administradores"
        action={<Link to="/" className="btn btn-secondary">Volver al inicio</Link>}
      >
        Tu cuenta no tiene permiso para gestionar roles.
      </EmptyState>
    )
  }

  // Filtros en el cliente: la comunidad es chica y la lista ya viene entera.
  const q = term.trim().toLowerCase()
  const count = (r) => users.filter(u => (u.role || 'user') === r).length
  const shown = users.filter(u =>
    (roleFilter === 'all' || (u.role || 'user') === roleFilter) &&
    (!q || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
  )

  const filters = [
    { value: 'all', label: 'Todos' },
    ...ROLES.filter(r => count(r) > 0).map(r => ({ value: r, label: `${ROLE_PLURAL[r]} (${count(r)})` })),
  ]

  return (
    <AdminLayout
      title="Panel"
      lead="Los editores administran el catálogo y las colecciones. Los admins, además, los roles de la gente."
    >
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="seg">
          {filters.map(f => (
            <label key={f.value} className="seg-opt">
              <input
                type="radio"
                name="usuarios-rol"
                checked={roleFilter === f.value}
                onChange={() => setRoleFilter(f.value)}
              />
              <span>{f.label}</span>
            </label>
          ))}
        </div>

        <div className="relative flex items-center flex-1 min-w-[200px]">
          <IconSearch size={15} className="absolute left-4 text-gray-500 pointer-events-none" />
          <input
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="Buscar por nombre o email"
            aria-label="Buscar usuario"
            className="input pl-10"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-rock-accentBright bg-rock-accent/10 rounded-[14px] px-4 py-2.5 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <SkeletonRows count={5} />
      ) : shown.length === 0 ? (
        <p className="text-gray-500 text-sm">Nadie coincide con ese filtro.</p>
      ) : (
        <>
          {/* Sin overflow-hidden: el menú "⋯" de la última fila sale por abajo. */}
          <div className="card !p-0">
            {shown.map(u => (
              <UserRow
                key={u.id}
                u={u}
                isSelf={u.id === currentUser?.id}
                busy={isPending}
                onRole={changeRole}
              />
            ))}
          </div>
          <p className="text-gray-500 text-[13px] mt-3">
            {shown.length === users.length ? `${users.length} en total` : `${shown.length} de ${users.length}`}
          </p>
        </>
      )}
    </AdminLayout>
  )
}
