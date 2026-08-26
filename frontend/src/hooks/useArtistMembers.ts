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

export type Person = {
  key: string
  name: string
  slug: string | null
  memberMbId: string | null
  image?: string | null
  roles: string[]
  periods: string[]
  /** Tramos con años resueltos, para dibujar la línea de tiempo. */
  segments: { from: number; to: number }[]
  isOriginal: boolean
  active: boolean
  firstYear: number | null
  years: number
  /** Las filas originales, para el panel de edición, que trabaja por etapa. */
  stages: Member[]
}

/** Años que estuvo, sumando todas sus etapas. Una etapa sin fecha cuenta 1. */
function tenureOf(stage: Member) {
  if (stage.year_from === null) return 1
  const end = stage.year_to ?? (stage.ended ? stage.year_from : new Date().getFullYear())
  return Math.max(1, end - stage.year_from + 1)
}

function periodOf(stage: Member) {
  const { year_from: from, year_to: to, ended } = stage
  if (from && to) return from === to ? String(from) : `${from}–${to}`
  if (from) return ended ? String(from) : `${from}–hoy`
  if (to) return `→${to}`
  return 's/f'
}

/**
 * Junta las etapas de cada músico en una sola entrada, como las lista
 * Wikipedia: «Charly García – voz, piano, teclados, guitarra (1968–1975)
 * (1981) (2000–2001)».
 *
 * En la base cada etapa es su propia fila, que es lo correcto para editarlas y
 * para saber quién se solapó con quién. Pero leídas de corrido separan a una
 * misma persona en filas lejanas y la formación se vuelve ilegible.
 *
 * El orden imita al de Wikipedia: primero por año de entrada, y entre los que
 * entraron el mismo año primero el que más tiempo estuvo. Así el núcleo de la
 * banda queda arriba sin tener que marcarlo a mano.
 */
export function groupByPerson(stages: (Member & { member?: any })[]): Person[] {
  return groupStages(stages, stage => ({
    key: stage.member_mb_id || `name:${stage.member_name}`,
    name: stage.member_name,
    slug: stage.member?.hidden ? null : stage.member?.slug || null,
    memberMbId: stage.member_mb_id,
  }))
}

/**
 * La otra dirección: las bandas por las que pasó un músico, una fila por banda.
 *
 * Mismo problema que del lado de la formación: Charly García estuvo tres veces
 * en Sui Generis y sin agrupar la trayectoria lo repite tres veces.
 */
export function groupByBand(stages: (Member & { group?: any })[]): Person[] {
  return groupStages(stages, stage => ({
    key: stage.group?.id || `name:${stage.group?.name}`,
    name: stage.group?.name || '—',
    slug: stage.group?.slug || null,
    memberMbId: null,
    image: stage.group?.image_url || null,
  }))
}

function groupStages(
  stages: Member[],
  identify: (stage: any) => { key: string; name: string; slug: string | null; memberMbId: string | null; image?: string | null }
): Person[] {
  const people = new Map<string, Person>()

  for (const stage of stages) {
    const id = identify(stage)
    let person = people.get(id.key)

    if (!person) {
      person = {
        ...id,
        roles: [],
        periods: [],
        segments: [],
        isOriginal: false,
        active: false,
        firstYear: null,
        years: 0,
        stages: [],
      }
      people.set(id.key, person)
    }

    person.stages.push(stage)
    for (const role of stage.roles || []) {
      if (!person.roles.includes(role)) person.roles.push(role)
    }
    person.isOriginal = person.isOriginal || stage.is_original
    person.active = person.active || !stage.ended
    person.years += tenureOf(stage)
    if (stage.year_from !== null && (person.firstYear === null || stage.year_from < person.firstYear)) {
      person.firstYear = stage.year_from
    }
  }

  for (const person of people.values()) {
    const ordered = sortStages(person.stages)
    person.stages = ordered
    person.periods = ordered.map(periodOf)
    // Sólo los tramos con año de entrada se pueden dibujar. Los que
    // MusicBrainz no fechó quedan fuera del gráfico y se listan aparte.
    person.segments = ordered
      .filter(s => s.year_from !== null)
      .map(s => ({
        from: s.year_from as number,
        to: s.year_to ?? (s.ended ? (s.year_from as number) : new Date().getFullYear()),
      }))
  }

  return [...people.values()]
    .sort((a, b) => {
      if (a.firstYear !== b.firstYear) {
        if (a.firstYear === null) return 1
        if (b.firstYear === null) return -1
        return a.firstYear - b.firstYear
      }
      if (a.years !== b.years) return b.years - a.years
      return a.name.localeCompare(b.name)
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
 * La formación de varias bandas de una sola vez.
 *
 * La timeline de una década muestra treinta discos, y cada uno necesita saber
 * quiénes estaban en la banda ese año. Pidiéndolo por disco son veinte idas y
 * vueltas al abrir la página; así es una.
 *
 * Devuelve lo mismo que `useBandMembers` pero indexado por banda, y ya agrupado
 * por músico para que cada entrada no repita el trabajo.
 */
export function useBandMembersMany(artistIds: (string | undefined)[]) {
  const ids = [...new Set(artistIds.filter(Boolean) as string[])].sort()

  return useQuery({
    queryKey: ['band-members-many', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artist_members')
        .select(`${COLUMNS}, member:artists!artist_members_member_id_fkey (id, slug, hidden)`)
        .in('group_id', ids)
      if (error) throw error

      const byGroup = new Map<string, Member[]>()
      for (const row of (data || []) as Member[]) {
        if (!byGroup.has(row.group_id)) byGroup.set(row.group_id, [])
        byGroup.get(row.group_id)!.push(row)
      }

      const grouped: Record<string, Person[]> = {}
      for (const [groupId, rows] of byGroup) grouped[groupId] = groupByPerson(rows)
      return grouped
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

/**
 * Quiénes estaban en la banda en un año dado.
 *
 * Se deriva de las fechas de cada etapa en vez de guardarse por disco. Con una
 * tabla por álbum, corregir la fecha de salida de un baterista obligaría a
 * arreglar disco por disco; así se arregla una vez y se acomodan todos los años
 * que toca.
 *
 * Las etapas sin año de entrada quedan afuera: no se puede afirmar que alguien
 * estaba en 1972 cuando lo único que se sabe es que se fue en 1974.
 */
export function lineupAt(people: Person[], year: number | null) {
  if (!year) return []
  return people.filter(person =>
    person.segments.some(seg => seg.from <= year && year <= seg.to)
  )
}

/**
 * Refresca la formación en pantalla.
 *
 * Las mutaciones la llaman solas, pero la importación de MusicBrainz va por
 * REST contra el backend y React Query no se entera: sin esto la card queda
 * como estaba hasta recargar la página.
 */
export function useInvalidateMembers() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of ['band-members', 'band-members-many', 'member-trajectory']) {
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

/**
 * Saca a un músico de la banda entera, con todas sus etapas.
 *
 * Sin esto, quitar a alguien que entró, se fue y volvió obliga a borrar tres
 * filas de a una, y entre borrado y borrado la formación queda a medias.
 */
export function useDeletePerson() {
  const invalidate = useInvalidateMembers()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('artist_members').delete().in('id', ids)
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
