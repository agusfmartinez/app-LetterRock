-- ============================================
-- FASE 2.2 — COLECCIONES EDITORIALES
-- Timelines, top lists y rankings sobre un mismo modelo.
-- El campo `type` define cómo se renderiza.
-- Requiere 001_roles.sql (usa is_editor()).
-- ============================================

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'timeline'
    CHECK (type IN ('timeline', 'list', 'ranking')),
  description TEXT,
  cover_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_slug ON collections(slug);
CREATE INDEX IF NOT EXISTS idx_collections_type ON collections(type);

-- Secciones: sólo las usan los timelines (una por década, por ejemplo).
CREATE TABLE IF NOT EXISTS collection_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  intro_text TEXT,
  cover_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_sections_collection ON collection_sections(collection_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_sections_slug ON collection_sections(collection_id, slug);

-- Entries: apuntan a un artista o álbum ya ingestado, más texto editorial.
-- `narrative` = bloque de texto suelto, sin entidad asociada.
CREATE TABLE IF NOT EXISTS collection_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  section_id UUID REFERENCES collection_sections(id) ON DELETE CASCADE,
  entry_type VARCHAR(20) NOT NULL DEFAULT 'album'
    CHECK (entry_type IN ('artist', 'album', 'narrative')),
  artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  title VARCHAR(255),
  body_text TEXT,
  year INTEGER,
  rank INTEGER,
  source VARCHAR(255),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  -- Cada entry apunta a lo que corresponde a su tipo.
  CONSTRAINT collection_entries_target_check CHECK (
    (entry_type = 'album'     AND album_id IS NOT NULL) OR
    (entry_type = 'artist'    AND artist_id IS NOT NULL) OR
    (entry_type = 'narrative' AND album_id IS NULL AND artist_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_collection_entries_collection ON collection_entries(collection_id, position);
CREATE INDEX IF NOT EXISTS idx_collection_entries_section ON collection_entries(section_id, position);
CREATE INDEX IF NOT EXISTS idx_collection_entries_album ON collection_entries(album_id);
-- Un mismo álbum no se repite dentro de una sección.
CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_entries_unique_album
  ON collection_entries(section_id, album_id) WHERE album_id IS NOT NULL;

-- updated_at
CREATE OR REPLACE TRIGGER collections_updated_at BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER collection_sections_updated_at BEFORE UPDATE ON collection_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER collection_entries_updated_at BEFORE UPDATE ON collection_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS: lectura pública sólo de lo publicado; escritura sólo editores/admins.
-- ============================================

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published collections are public" ON collections;
CREATE POLICY "Published collections are public" ON collections
  FOR SELECT USING (is_published OR is_editor());
DROP POLICY IF EXISTS "Editors manage collections" ON collections;
CREATE POLICY "Editors manage collections" ON collections
  FOR ALL USING (is_editor()) WITH CHECK (is_editor());

DROP POLICY IF EXISTS "Sections follow collection visibility" ON collection_sections;
CREATE POLICY "Sections follow collection visibility" ON collection_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_sections.collection_id
      AND (c.is_published OR is_editor())
    )
  );
DROP POLICY IF EXISTS "Editors manage sections" ON collection_sections;
CREATE POLICY "Editors manage sections" ON collection_sections
  FOR ALL USING (is_editor()) WITH CHECK (is_editor());

DROP POLICY IF EXISTS "Entries follow collection visibility" ON collection_entries;
CREATE POLICY "Entries follow collection visibility" ON collection_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_entries.collection_id
      AND (c.is_published OR is_editor())
    )
  );
DROP POLICY IF EXISTS "Editors manage entries" ON collection_entries;
CREATE POLICY "Editors manage entries" ON collection_entries
  FOR ALL USING (is_editor()) WITH CHECK (is_editor());

-- ============================================
-- SEED — "Historia del rock argentino" con una sección por década.
-- Las entries las carga el editor (o vos por SQL, ver abajo).
-- ============================================

INSERT INTO collections (title, slug, type, description, is_published)
VALUES (
  'Historia del rock argentino',
  'historia-del-rock-argentino',
  'timeline',
  'Un recorrido disco por disco: cada década, sus álbumes fundamentales y la historia detrás de cada uno.',
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO collection_sections (collection_id, title, slug, subtitle, position)
SELECT c.id, s.title, s.slug, s.subtitle, s.position
FROM collections c
CROSS JOIN (VALUES
  ('Los 60', 'los-60', 'Donde empieza todo', 1),
  ('Los 70', 'los-70', 'Progresivo, censura y subterráneo', 2),
  ('Los 80', 'los-80', 'De Malvinas al estallido pop', 3),
  ('Los 90', 'los-90', 'Alternativo, barrial y masivo', 4),
  ('Los 2000', 'los-2000', 'Después de Cromañón', 5),
  ('Los 2010', 'los-2010', 'Indie, streaming y cruces', 6),
  ('Los 2020', 'los-2020', 'Lo que está pasando ahora', 7)
) AS s(title, slug, subtitle, position)
WHERE c.slug = 'historia-del-rock-argentino'
ON CONFLICT (collection_id, slug) DO NOTHING;

-- ============================================
-- Cargar un álbum a una década (ejemplo — correr desde el SQL Editor).
-- El orden dentro de la página lo calcula la app por release_date.
-- ============================================

-- INSERT INTO collection_entries (collection_id, section_id, entry_type, album_id, body_text)
-- SELECT c.id, s.id, 'album', a.id, 'Tu texto editorial sobre el disco.'
-- FROM collections c
-- JOIN collection_sections s ON s.collection_id = c.id AND s.slug = 'los-70'
-- JOIN albums a ON a.id = 'UUID-DEL-ALBUM'
-- WHERE c.slug = 'historia-del-rock-argentino';
