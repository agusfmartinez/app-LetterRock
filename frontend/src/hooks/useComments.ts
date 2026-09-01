import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'
import type { EntityType } from '../services/entities'

/**
 * Comentarios de cualquier entidad.
 *
 * `comments` es polimórfica igual que `reviews`, pero hasta ahora la única
 * pantalla que la usaba —la ficha de canción— la manejaba con sus propios
 * `useState` y funciones sueltas. Al sumar las colecciones eso habría quedado
 * duplicado, así que vive acá.
 *
 * Sigue el mismo patrón que `useReviews` (estado local, no React Query) para no
 * meter una tercera forma de hacer lo mismo en el proyecto.
 *
 * HOY NO LO USA NADIE, a propósito. Tener una opinión (puntaje + texto) y al
 * lado una caja de comentarios obligaba al usuario a decidir en cuál de las dos
 * escribir, y son lo mismo desde su punto de vista. Las obras y las colecciones
 * quedaron con una sola forma de decir algo.
 *
 * El lugar real de un comentario es responder a lo que alguien dijo
 * —`entity_type = 'review'`—, que no se pisa con nada. Queda armado para eso.
 */
export function useComments(entityType: EntityType, entityId: string | undefined) {
  const [comments, setComments] = useState<any[]>([])
  const { user } = useAuthStore()

  const fetchComments = async () => {
    if (!entityId) return
    const { data } = await supabase
      .from('comments')
      .select('*, user:users(username, avatar_url)')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  useEffect(() => {
    fetchComments()
  }, [entityType, entityId])

  const createComment = async (body: string) => {
    if (!user || !entityId) return new Error('No autenticado')
    const { error } = await supabase.from('comments').insert({
      user_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
      body,
    })
    if (!error) fetchComments()
    return error
  }

  const deleteComment = async (commentId: string) => {
    await supabase.from('comments').delete().eq('id', commentId)
    fetchComments()
  }

  return { comments, createComment, deleteComment, refetch: fetchComments }
}
