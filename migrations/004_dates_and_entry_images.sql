-- ============================================
-- FASE 2.4 — PRECISIÓN DE FECHAS + IMAGEN EN BLOQUES NARRATIVOS
-- ============================================

-- 1. Precisión de la fecha de edición.
-- La ingesta guarda '1973-01-01' tanto para un disco del 1 de enero como para
-- uno del que Spotify sólo sabe el año. Sin este dato no se puede mostrar
-- día y mes sin inventar fechas.
ALTER TABLE albums
  ADD COLUMN IF NOT EXISTS release_date_precision VARCHAR(10);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'albums_release_date_precision_check'
  ) THEN
    ALTER TABLE albums
      ADD CONSTRAINT albums_release_date_precision_check
      CHECK (release_date_precision IN ('year', 'month', 'day'));
  END IF;
END $$;

-- Las filas viejas quedan en NULL. La app las resuelve infiriendo la precisión
-- de la fecha misma (ver effectivePrecision en services/dates.ts): un día
-- distinto de 1 sólo pudo venir de una fecha exacta. Se completan de verdad
-- cuando la banda se vuelva a ingestar (upsert por external_spotify_id).

-- 2. Imagen opcional en los bloques narrativos (una foto de época, un afiche).
ALTER TABLE collection_entries
  ADD COLUMN IF NOT EXISTS image_url TEXT;
