-- ============================================
-- FASE 2.3 — RANGO DE AÑOS POR SECCIÓN
-- El panel de editor sugiere qué álbumes de la DB entran en cada época.
-- Sin este rango no hay forma de saber qué le corresponde a "Los 70".
-- ============================================

ALTER TABLE collection_sections
  ADD COLUMN IF NOT EXISTS year_from INTEGER,
  ADD COLUMN IF NOT EXISTS year_to INTEGER;

-- Backfill de las décadas sembradas en 002.
UPDATE collection_sections s
SET year_from = v.year_from, year_to = v.year_to
FROM (VALUES
  ('los-60', 1960, 1969),
  ('los-70', 1970, 1979),
  ('los-80', 1980, 1989),
  ('los-90', 1990, 1999),
  ('los-2000', 2000, 2009),
  ('los-2010', 2010, 2019),
  ('los-2020', 2020, 2029)
) AS v(slug, year_from, year_to)
WHERE s.slug = v.slug
  AND s.year_from IS NULL
  AND s.collection_id = (
    SELECT id FROM collections WHERE slug = 'historia-del-rock-argentino'
  );
