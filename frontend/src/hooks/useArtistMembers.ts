import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { describeError } from './useCollectionAdmin'
import { supabase } from '../services/supabaseClient'

export { describeError }

export type Member = {
  id: string
  group_id: string
  member_id: string | null
  member_mb_id: string | null
  member_name: string
  roles: string[]
  year_from: number | null
  year_to: number | null
  is_original: boolean
  ended: boolean
  notes: string | null
  source: 'manual' | 'musicbrainz'
  mb_key: string | null
  manual_fields: string[]
}

const COLUMNS = `
  id, group_id, member_id, member_mb_id, member_name, roles,
  year_from, year_to, is_original, ended, notes, source, mb_key, manual_fields
`

/**
 * Campos que la importación de MusicBrainz reescribe. Igual que en el catálogo,
 * editarlos a mano los deja protegidos de la próxima corrida.
 */
const IMPORTED_FIELDS = ['member_name', 'roles', 'year_from', 'year_to', 'is_original', 'ended']

function nextManualFields(current: string[] | null, patch: Record<string, any>) {
  const protectedNow = new Set(current || [])
  for (const key of Object.keys(patch)) {
    if (IMPORTED_FIELDS.includes(key)) protectedNow.add(key)
  }
  return [...protectedNow]
}

/** Instrumentos como los nombra MusicBrainz, en inglés y a veces con paréntesis. */
const ROLE_LABELS: Record<string, string> = {
  'lead vocals': 'voz',
  'background vocals': 'coros',
  'vocals': 'voz',
  'guitar': 'guitarra',
  'electric guitar': 'guitarra eléctrica',
  'acoustic guitar': 'guitarra acústica',
  'bass guitar': 'bajo',
  'electric bass guitar': 'bajo eléctrico',
  'double bass': 'contrabajo',
  'drums (drum set)': 'batería',
  'drums': 'batería',
  'electronic drum set': 'batería electrónica',
  'membranophone': 'percusión',
  'percussion': 'percusión',
  'keyboard': 'teclados',
  'piano': 'piano',
  'electric piano': 'piano eléctrico',
  'organ': 'órgano',
  'synthesizer': 'sintetizador',
  'flute': 'flauta',
  'saxophone': 'saxo',
  'violin': 'violín',
  'cello': 'cello',
  'harmonica': 'armónica',
  'mandolin': 'mandolina',
  'trumpet': 'trompeta',
  'charango': 'charango',
}

export function roleLabel(role: string) {
  return ROLE_LABELS[role.toLowerCase()] || role
}

/** "1968 – 1975", "desde 1972", "1981" o "sin fecha". */
export function formatPeriod(member: Pick<Member, 'year_from' | 'year_to' | 'ended'>) {
  const { year_from: from, year_to: to, ended } = member
  if (from && to) return from === to ? String(from) : `${from} – ${to}`
  if (from) return ended ? `desde ${from}` : `${from} – hoy`
  if (to) return `hasta ${to}`
  return 'sin fecha'
}

/**
 * Ordena las etapas como se leen: por año de entrada.
 *
 * Las que no tienen año de entrada se ubican por el de salida, que es la única
 * pista que queda: "hasta 1974" se puede leer en la línea de tiempo, "sin
 * fecha" no, y por eso ésas van últimas.
 */
function sortStages(rows: Member[]) {
  const anchor = (row: Member) => row.year_from ?? row.year_to ?? null

  return [...rows].sort((a, b) => {
    const ay = anchor(a)
    const by = anchor(b)
    if (ay === by) return a.member_name.localeCompare(b.member_name)
    if (ay === null) return 1
    if (by === null) return -1
    return ay - by
  })
}

/** Formación de una banda. */
export function useBandMembers(groupId?: string) {
  return useQuery({
    queryKey: ['band-members', groupId],
    enabled: Boolean(groupId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artist_members')
        .select(`${COLUMNS}, member:artists!artist_members_member_id_fkey (id, slug, hidden)`)
        .eq('group_id', groupId)
      if (error) throw error
      return sortStages((data || []) as Member[]) as (Member & { member: any })[]
    },
  })
}

/**
 * Las bandas por las que pasó un músico.
 *
 * Se busca por `member_mb_id` y no por `member_id` porque la mayoría de los
 * integrantes no tiene ficha propia en el catálogo: el id de MusicBrainz es lo
 * único que los identifica siempre.
 */
export function useMemberTrajectory(memberMbId?: string | null) {
  return useQuery({
    queryKey: ['member-trajectory', memberMbId],
    enabled: Boolean(memberMbId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artist_members')
        .select(`${COLUMNS}, group:artists!artist_members_group_id_fkey (id, name, slug, image_url, hidden)`)
        .eq('member_mb_id', memberMbId)
      if (error) throw error
      const rows = (data || []).filter((r: any) => !r.group?.hidden)
      return sortStages(rows as Member[]) as (Member & { group: any })[]
    },
  })
}

function useInvalidateMembers() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of ['band-members', 'member-trajectory']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
}

export function useCreateMember() {
  const invalidate = useInvalidateMembers()

  return useMutation({
    mutationFn: async (row: Partial<Member>) => {
      const { error } = await supabase
        .from('artist_members')
        .insert({ ...row, source: 'manual' })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateMember() {
  const invalidate = useInvalidateMembers()

  return useMutation({
    mutationFn: async ({ id, manual_fields, ...patch }: any) => {
      const { error } = await supabase
        .from('artist_members')
        .update({ ...patch, manual_fields: nextManualFields(manual_fields, patch) })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteMember() {
  const invalidate = useInvalidateMembers()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('artist_members').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
