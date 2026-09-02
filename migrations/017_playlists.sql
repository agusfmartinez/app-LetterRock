-- ============================================
-- 017 — Playlist adjunta
--
-- Quien arma una colección casi siempre ya la tiene armada en Spotify o en
-- YouTube. Pegar ese link es la forma más corta de que la colección suene, y no
-- depende de ninguna API: los dos servicios publican un embed para playlists.
--
-- Va en la colección y también en la época, porque en una timeline lo que se
-- lee de corrido es la época: la playlist de "Los 70" no es la de toda la
-- historia del rock argentino.
--
-- Se guarda la URL cruda tal como la pegaron y no un (proveedor, id) partido en
-- dos columnas. El parseo vive en el front, que es donde también hace falta para
-- avisar en el momento que un link no se reconoce; partirlo en la base además
-- obligaría a migrar la tabla el día que se sume un tercer servicio.
--
-- Correr en el SQL Editor de Supabase.
-- ============================================

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS playlist_url TEXT;

ALTER TABLE collection_sections
  ADD COLUMN IF NOT EXISTS playlist_url TEXT;
