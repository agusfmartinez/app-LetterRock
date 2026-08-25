-- ============================================
-- FASE 2.6 — LINKS A PLATAFORMAS, NORMALIZADOS
-- Una fila por (entidad, proveedor). Hoy Spotify y YouTube;
-- sumar Apple/Tidal/Deezer después no toca el schema.
-- ============================================

CREATE TABLE IF NOT EXISTS media_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('artist', 'album', 'track')),
  entity_id UUID NOT NULL,
  provider VARCHAR(20) NOT NULL
    CHECK (provider IN ('spotify', 'youtube', 'apple', 'tidal', 'deezer')),
  external_id VARCHAR(255) NOT NULL,
  url TEXT,
  -- Reproducciones informadas por el proveedor. Sólo YouTube publica un número
  -- real; el resto queda en NULL. Se guarda acá y no en `tracks` para no tener
  -- una columna por plataforma.
  play_count BIGINT,
  play_count_updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_links_entity ON media_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_media_links_provider ON media_links(provider, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_links_unique
  ON media_links(entity_type, entity_id, provider);

CREATE OR REPLACE TRIGGER media_links_updated_at BEFORE UPDATE ON media_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS: lectura pública, escritura de editores.
-- El backend usa la service_role key, así que no pasa por estas policies.
-- ============================================

ALTER TABLE media_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Media links are public" ON media_links;
CREATE POLICY "Media links are public" ON media_links
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Editors manage media links" ON media_links;
CREATE POLICY "Editors manage media links" ON media_links
  FOR ALL USING (is_editor()) WITH CHECK (is_editor());

-- ============================================
-- BACKFILL — pasa a la tabla todo el Spotify ya cargado.
-- Sin llamadas a ninguna API: sale de las columnas external_spotify_id.
-- `external_spotify_id` NO se borra: la ingesta lo sigue usando como clave
-- de upsert. media_links es el camino de lectura de la app.
-- ============================================

INSERT INTO media_links (entity_type, entity_id, provider, external_id, url)
SELECT 'artist', id, 'spotify', external_spotify_id,
       'https://open.spotify.com/artist/' || external_spotify_id
FROM artists
WHERE external_spotify_id IS NOT NULL
ON CONFLICT (entity_type, entity_id, provider) DO NOTHING;

INSERT INTO media_links (entity_type, entity_id, provider, external_id, url)
SELECT 'album', id, 'spotify', external_spotify_id,
       'https://open.spotify.com/album/' || external_spotify_id
FROM albums
WHERE external_spotify_id IS NOT NULL
ON CONFLICT (entity_type, entity_id, provider) DO NOTHING;

INSERT INTO media_links (entity_type, entity_id, provider, external_id, url)
SELECT 'track', id, 'spotify', external_spotify_id,
       'https://open.spotify.com/track/' || external_spotify_id
FROM tracks
WHERE external_spotify_id IS NOT NULL
ON CONFLICT (entity_type, entity_id, provider) DO NOTHING;

-- Control: cuántos links quedaron por entidad y proveedor.
SELECT entity_type, provider, COUNT(*)
FROM media_links
GROUP BY entity_type, provider
ORDER BY entity_type, provider;
