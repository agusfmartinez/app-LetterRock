import { useState, useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'

export function useReviews(entityType: string, entityId: string | undefined) {
  const [reviews, setReviews] = useState<any[]>([])
  const { user } = useAuthStore()

  const fetchReviews = async () => {
    if (!entityId) return
    const { data } = await supabase
      .from('reviews')
      .select('*, user:users(username, avatar_url)')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
    setReviews(data || [])
  }

  useEffect(() => {
    fetchReviews()
  }, [entityType, entityId])

  const createReview = async ({ rating, text }: { rating: number; text: string }) => {
    if (!user || !entityId) return new Error('No autenticado')
    const { error } = await supabase.from('reviews').upsert(
      {
        user_id: user.id,
        entity_type: entityType,
        entity_id: entityId,
        rating,
        text: text || null,
      },
      { onConflict: 'user_id,entity_type,entity_id' }
    )
    if (!error) fetchReviews()
    return error
  }

  const deleteReview = async (reviewId: string) => {
    await supabase.from('reviews').delete().eq('id', reviewId)
    fetchReviews()
  }

  return { reviews, createReview, deleteReview, refetch: fetchReviews }
}
