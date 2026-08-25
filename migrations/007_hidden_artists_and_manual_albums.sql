-- ============================================
-- FASE 3.2 — ARTISTAS OCULTOS + ALTA MANUAL DE DISCOS
-- ============================================

-- 1. Ocultar en vez de borrar.
--
-- Borrar un artista no sirve: la búsqueda cae a MusicBrainz cuando no encuentra
-- nada en la DB, y al entrar al resultado `saveArtist` lo vuelve a crear. La
-- única forma de que no reaparezca es dejar la marca en la base.
--
-- `saveArtist` hace upsert sin incluir esta columna, así que el flag sobrevive
-- a cualquier reingesta.
ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_artists_hidden ON artists(hidden) WHERE hidden;

-- 2. Lo mismo para los discos.
--
-- Borrar un álbum tampoco alcanza: el upsert por external_spotify_id lo vuelve
-- a crear en el próximo refresco desde Spotify. Sirve para recopilados,
-- reediciones o discos que no querés que figuren en la discografía.
ALTER TABLE albums
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_albums_hidden ON albums(hidden) WHERE hidden;

-- 3. Alta manual de discos y canciones.
-- Un disco cargado a mano no tiene external_spotify_id, así que la ingesta
-- nunca lo va a tocar.
DROP POLICY IF EXISTS "Editors insert albums" ON albums;
CREATE POLICY "Editors insert albums" ON albums
  FOR INSERT WITH CHECK (is_editor());

DROP POLICY IF EXISTS "Editors insert tracks" ON tracks;
CREATE POLICY "Editors insert tracks" ON tracks
  FOR INSERT WITH CHECK (is_editor());
