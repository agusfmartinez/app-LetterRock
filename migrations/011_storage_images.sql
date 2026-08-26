-- ============================================
-- 011 — Subida de imágenes (Supabase Storage)
--
-- Hasta ahora toda imagen que no viniera de Spotify se cargaba pegando una URL
-- de otro sitio. Eso deja el catálogo colgado de servidores ajenos: la imagen
-- desaparece cuando el otro la borra, y muchos hosts bloquean el hotlinking, así
-- que el álbum queda con el recuadro roto sin que nadie toque nada acá.
--
-- Un solo bucket con carpetas por destino. Dos buckets (uno público de catálogo
-- y otro de avatares) obligaría a duplicar el componente de subida y a decidir
-- en cada llamada a cuál va; la diferencia real es de permisos, y eso se resuelve
-- con policies sobre el prefijo del path.
--
-- Correr en el SQL Editor de Supabase.
-- ============================================

-- ============================================
-- 1. El bucket
--
-- Público de lectura: las imágenes se muestran a cualquiera que entre a la app,
-- incluso sin sesión. Firmar cada URL no protegería nada —el contenido es
-- público por definición— y rompería el cacheo del CDN.
--
-- El límite de tamaño y los tipos permitidos van acá y no sólo en el cliente:
-- el cliente se puede saltear, y Storage rechaza el archivo antes de guardarlo.
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  TRUE,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- 2. Lectura
--
-- El flag `public` del bucket ya alcanza para servir por URL pública; esta policy
-- es la que habilita además listar y leer desde el cliente con sesión.
-- ============================================
DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
CREATE POLICY "media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- ============================================
-- 3. Escritura del catálogo: sólo editores
--
-- Todo lo que no sea `avatars/` es contenido editorial —portadas, fotos de
-- artista, imágenes de bloques—, así que lo maneja quien edita el catálogo.
-- Mismo criterio que las policies de UPDATE de artists/albums en la 006.
-- ============================================
DROP POLICY IF EXISTS "media_editors_insert" ON storage.objects;
CREATE POLICY "media_editors_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] <> 'avatars'
    AND is_editor()
  );

DROP POLICY IF EXISTS "media_editors_update" ON storage.objects;
CREATE POLICY "media_editors_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] <> 'avatars'
    AND is_editor()
  );

DROP POLICY IF EXISTS "media_editors_delete" ON storage.objects;
CREATE POLICY "media_editors_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] <> 'avatars'
    AND is_editor()
  );

-- ============================================
-- 4. Avatares: cada uno el suyo
--
-- El path es `avatars/<uid>/<archivo>`, y la policy compara ese segundo segmento
-- con `auth.uid()`. Sin eso, cualquier usuario con sesión podría sobreescribir
-- la foto de otro: el bucket es uno solo y el nombre del archivo lo elige quien
-- sube.
-- ============================================
DROP POLICY IF EXISTS "avatars_own_insert" ON storage.objects;
CREATE POLICY "avatars_own_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_own_update" ON storage.objects;
CREATE POLICY "avatars_own_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_own_delete" ON storage.objects;
CREATE POLICY "avatars_own_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
