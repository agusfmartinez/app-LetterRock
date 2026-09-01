-- ============================================
-- 016 — Colecciones de canciones
--
-- `collection_entries` sabía apuntar a un disco, a un artista, o a nada (los
-- bloques de texto). Faltaba la canción, que es lo que hace falta para armar
-- "las diez mejores canciones" y lo que después convierte una colección en una
-- playlist tema por tema.
--
-- Correr en el SQL Editor de Supabase.
-- ============================================

ALTER TABLE collection_entries
  ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES tracks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_collection_entries_track ON collection_entries(track_id);

-- Los dos CHECK van juntos: uno dice qué tipos existen y el otro que cada
-- entrada apunte a lo que le corresponde. Cambiar sólo el primero dejaría pasar
-- una entrada de tipo `track` sin ninguna canción.
ALTER TABLE collection_entries DROP CONSTRAINT IF EXISTS collection_entries_entry_type_check;
ALTER TABLE collection_entries ADD CONSTRAINT collection_entries_entry_type_check
  CHECK (entry_type IN ('artist', 'album', 'track', 'narrative'));

ALTER TABLE collection_entries DROP CONSTRAINT IF EXISTS collection_entries_target_check;
ALTER TABLE collection_entries ADD CONSTRAINT collection_entries_target_check CHECK (
  (entry_type = 'album'     AND album_id  IS NOT NULL) OR
  (entry_type = 'artist'    AND artist_id IS NOT NULL) OR
  (entry_type = 'track'     AND track_id  IS NOT NULL) OR
  (entry_type = 'narrative' AND album_id IS NULL AND artist_id IS NULL AND track_id IS NULL)
);

-- Una canción no se repite dentro de la misma colección.
--
-- Va por `collection_id` y no por `section_id` como el índice equivalente de los
-- discos: una lista o un ranking no tienen sección, y ahí `section_id` es NULL.
-- Dos NULL no chocan entre sí en un índice único, así que esa versión no
-- protegería nada justo en las colecciones donde más fácil es repetir un tema.
--
-- Sin cláusula WHERE por el mismo motivo del lado bueno: `track_id` es NULL en
-- las entradas que no son canciones, y por eso no se estorban entre sí.
CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_entries_unique_track
  ON collection_entries(collection_id, track_id);
