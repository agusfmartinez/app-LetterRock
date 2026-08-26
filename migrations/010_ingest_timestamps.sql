-- ============================================
-- FASE 3.3.2 — CUÁNDO CORRIÓ CADA INGESTA
-- ============================================
--
-- `updated_at` no sirve para esto. Se mueve por cualquier escritura: la bio de
-- Wikipedia, la imagen de Spotify, una corrección del CRUD. Mirándolo no se
-- puede saber si un artista fue vinculado a YouTube alguna vez.
--
-- Y esa pregunta es real: los discos de los 80 seguían mostrando la playlist
-- del álbum en vez del tema destacado, y no había forma de listar a quiénes les
-- faltaba la vinculación sin abrirlos uno por uno.
--
-- NULL significa "nunca corrió", que es justamente lo que hay que poder buscar.
ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS spotify_refreshed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS youtube_linked_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS members_imported_at  TIMESTAMPTZ;

-- Índice parcial: la consulta que interesa es "los que nunca se vincularon",
-- así que sólo se indexan esas filas y el índice se achica solo a medida que
-- vas completando el catálogo.
CREATE INDEX IF NOT EXISTS idx_artists_never_youtube
  ON artists(name)
  WHERE youtube_linked_at IS NULL;
