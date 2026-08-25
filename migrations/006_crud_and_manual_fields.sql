-- ============================================
-- FASE 3.1 — CRUD DE CATÁLOGO
-- Descripción editorial del álbum + protección de las correcciones manuales
-- + permisos de escritura para editores.
-- ============================================

-- 1. Texto del disco, para la ficha y como base del texto de la timeline.
ALTER TABLE albums
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Campos corregidos a mano.
--
-- La ingesta hace upsert por external_spotify_id y reescribe título, fecha,
-- portada y tipo en cada corrida. Sin esta lista, cualquier corrección del
-- admin se perdería la próxima vez que alguien entre al artista.
-- La ingesta saca de su payload todo lo que figure acá.
ALTER TABLE artists ADD COLUMN IF NOT EXISTS manual_fields TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE albums  ADD COLUMN IF NOT EXISTS manual_fields TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE tracks  ADD COLUMN IF NOT EXISTS manual_fields TEXT[] NOT NULL DEFAULT '{}';

-- ============================================
-- 3. RLS: hasta ahora el catálogo era sólo lectura desde el cliente y todo lo
-- escribía el backend con la service_role key. El CRUD escribe desde el
-- navegador, así que necesita permisos propios.
--
-- Editar: editores y admins. Borrar: sólo admins — borrar un artista se lleva
-- puestos sus álbumes, tracks, reviews y favoritos por cascada.
-- ============================================

DROP POLICY IF EXISTS "Editors update artists" ON artists;
CREATE POLICY "Editors update artists" ON artists
  FOR UPDATE USING (is_editor()) WITH CHECK (is_editor());

DROP POLICY IF EXISTS "Editors update albums" ON albums;
CREATE POLICY "Editors update albums" ON albums
  FOR UPDATE USING (is_editor()) WITH CHECK (is_editor());

DROP POLICY IF EXISTS "Editors update tracks" ON tracks;
CREATE POLICY "Editors update tracks" ON tracks
  FOR UPDATE USING (is_editor()) WITH CHECK (is_editor());

DROP POLICY IF EXISTS "Admins delete artists" ON artists;
CREATE POLICY "Admins delete artists" ON artists
  FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "Admins delete albums" ON albums;
CREATE POLICY "Admins delete albums" ON albums
  FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "Admins delete tracks" ON tracks;
CREATE POLICY "Admins delete tracks" ON tracks
  FOR DELETE USING (is_admin());
