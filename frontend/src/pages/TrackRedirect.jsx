import { Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { NotFoundLine, SkeletonFicha } from '../components/common/States'
import { supabase } from '../services/supabaseClient'

/*
 * La canción ya no tiene página: se abre dentro de la ficha de su disco
 * (`/album/:id?tema=:trackId`). Los links viejos a `/track/:id` — feed,
 * perfiles, colecciones, buscadores — pasan por acá.
 */
export default function TrackRedirect() {
  const { id } = useParams()

  // Una canción no cambia de disco: se cachea para siempre.
  const { data: albumId, isLoading } = useQuery({
    queryKey: ['track-album-id', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tracks')
        .select('album_id')
        .eq('id', id)
        .single()
      return data?.album_id || null
    },
    staleTime: Infinity,
  })

  if (isLoading) return <div className="py-11"><SkeletonFicha lines={4} /></div>
  if (!albumId) return <NotFoundLine>Canción no encontrada.</NotFoundLine>
  return <Navigate replace to={`/album/${albumId}?tema=${id}`} />
}
