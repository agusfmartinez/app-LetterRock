import { supabase } from './supabaseClient'

const BUCKET = 'media'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/**
 * Extensión por tipo declarado y no por el nombre del archivo: el nombre puede
 * mentir ("foto.png" que en realidad es un JPEG) y el que importa para servirlo
 * después es el content-type.
 */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const ACCEPTED_IMAGE_TYPES = Object.keys(EXTENSIONS).join(',')

/** Carpetas del bucket. El primer segmento del path decide los permisos. */
export type MediaFolder = 'artists' | 'albums' | 'collections' | 'entries'

function describeUploadError(error: any): string {
  const message = String(error?.message || '')
  if (message.includes('mime type') || message.includes('not supported')) {
    return 'Ese tipo de archivo no está permitido. Subí un JPG, PNG, WEBP o GIF.'
  }
  if (message.includes('exceeded') || message.includes('too large')) {
    return 'La imagen supera los 5 MB.'
  }
  if (error?.statusCode === '403' || message.includes('row-level security')) {
    return 'No tenés permisos para subir imágenes.'
  }
  return message || 'No se pudo subir la imagen.'
}

/**
 * Sube una imagen y devuelve su URL pública.
 *
 * El nombre es aleatorio y no el del archivo original. Dos motivos: los nombres
 * repetidos ("portada.jpg") chocarían entre sí, y como cada subida estrena URL
 * el navegador nunca muestra la imagen vieja cacheada al reemplazarla — que es
 * lo que pasaría con un nombre estable por entidad.
 *
 * No borra la imagen anterior: la misma URL puede estar pegada en otra ficha, y
 * limpiar una que todavía se usa deja un recuadro roto que nadie sabe explicar.
 * Lo que queda huérfano se limpia desde el panel de Storage.
 */
export async function uploadImage(file: File, folder: MediaFolder | string): Promise<string> {
  const extension = EXTENSIONS[file.type]
  if (!extension) {
    throw new Error('Formato no soportado. Subí un JPG, PNG, WEBP o GIF.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('La imagen supera los 5 MB.')
  }

  const path = `${folder}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    // Un año: el path es único por subida, así que el contenido de esta URL no
    // va a cambiar nunca.
    cacheControl: '31536000',
  })
  if (error) throw new Error(describeUploadError(error))

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Carpeta del avatar de un usuario. La policy exige que el uid vaya en el path. */
export function avatarFolder(userId: string): string {
  return `avatars/${userId}`
}
