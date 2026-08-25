-- ============================================
-- FASE 3.3 — GRUPOS vs. PERSONAS + FORMACIONES
-- ============================================

-- 1. Distinguir bandas de músicos.
--
-- MusicBrainz ya lo trae en el campo `type` del artista ("Group", "Person",
-- "Orchestra", "Choir"...). Se normaliza a tres valores porque lo único que
-- cambia en la app es si la ficha muestra "Formación" (una banda y sus
-- integrantes) o "Trayectoria" (una persona y las bandas por las que pasó).
ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS artist_type TEXT
  CHECK (artist_type IN ('group', 'person', 'other'));

CREATE INDEX IF NOT EXISTS idx_artists_type ON artists(artist_type);

-- 2. El paso de los músicos por las bandas.
--
-- El integrante se guarda desnormalizado (`member_name` + `member_mb_id`) y no
-- como FK obligatoria a `artists`. Sui Generis solo tiene 22 personas en
-- MusicBrainz, la mayoría músicos de sesión sin discografía propia: crearles
-- fila en `artists` los metería en la búsqueda y en la home sin que nadie los
-- haya pedido.
--
-- `member_id` se completa sólo cuando esa persona ya existe en el catálogo
-- (Charly García, por ejemplo, que además es artista solista). Sirve para
-- enlazar a su ficha; la trayectoria se arma igual sin él, agrupando por
-- `member_mb_id`.
CREATE TABLE IF NOT EXISTS artist_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  group_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,

  member_id UUID REFERENCES artists(id) ON DELETE SET NULL,
  member_mb_id TEXT,
  member_name TEXT NOT NULL,

  -- Instrumentos y voces. MusicBrainz manda una relación por instrumento,
  -- así que la importación las junta en este array.
  roles TEXT[] NOT NULL DEFAULT '{}',

  -- Granularidad de año: alcanza para ordenar la línea de tiempo y es lo que
  -- MusicBrainz tiene completo. Las fechas exactas están sólo en un puñado de
  -- relaciones y no cambian cómo se lee la formación.
  year_from INT,
  year_to INT,

  -- Formación original de la banda.
  is_original BOOLEAN NOT NULL DEFAULT FALSE,
  -- La etapa terminó. Distinto de `year_to IS NULL`: hay bajas sin fecha.
  ended BOOLEAN NOT NULL DEFAULT FALSE,

  notes TEXT,

  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'musicbrainz')),

  -- Identidad estable de la relación en MusicBrainz: persona + tramo original.
  -- Sin esto, corregir un año a mano haría que la próxima importación creara
  -- una fila duplicada en vez de actualizar la que ya está.
  mb_key TEXT,

  manual_fields TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sin cláusula WHERE a propósito: el upsert de la importación infiere el índice
-- por sus columnas y PostgREST no puede apuntar a un índice parcial. Las filas
-- cargadas a mano llevan `mb_key` NULL y en un índice único los NULL no chocan
-- entre sí, así que pueden convivir todas las que haga falta.
CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_members_mb_key
  ON artist_members(group_id, mb_key);

CREATE INDEX IF NOT EXISTS idx_artist_members_group ON artist_members(group_id, year_from);
CREATE INDEX IF NOT EXISTS idx_artist_members_member ON artist_members(member_id);
CREATE INDEX IF NOT EXISTS idx_artist_members_member_mb ON artist_members(member_mb_id);

-- 3. Permisos: lectura pública, escritura de editores.
ALTER TABLE artist_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members are public" ON artist_members;
CREATE POLICY "Members are public" ON artist_members
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Editors insert members" ON artist_members;
CREATE POLICY "Editors insert members" ON artist_members
  FOR INSERT WITH CHECK (is_editor());

DROP POLICY IF EXISTS "Editors update members" ON artist_members;
CREATE POLICY "Editors update members" ON artist_members
  FOR UPDATE USING (is_editor()) WITH CHECK (is_editor());

DROP POLICY IF EXISTS "Editors delete members" ON artist_members;
CREATE POLICY "Editors delete members" ON artist_members
  FOR DELETE USING (is_editor());
