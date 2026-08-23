-- ============================================
-- SNIPPETS — cargar contenido en "Historia del rock argentino"
-- Para el SQL Editor de Supabase, hasta que exista el panel de editor (Fase 2.3).
-- ============================================

-- 1) Ver qué álbumes hay en la DB de una época, para elegir cuáles cargar.
SELECT ar.name AS banda, al.title AS album, al.release_date, al.id AS album_id
FROM albums al
JOIN artists ar ON ar.id = al.artist_id
WHERE al.release_date BETWEEN '1970-01-01' AND '1979-12-31'
  AND al.album_type = 'album'
ORDER BY al.release_date;

-- 2) Agregar un álbum a una década, buscándolo por banda + título.
--    Cambiá slug de sección, nombre de banda, título y texto.
INSERT INTO collection_entries (collection_id, section_id, entry_type, album_id, body_text)
SELECT c.id, s.id, 'album', al.id,
       'Tu texto editorial sobre el disco. Una línea en blanco separa párrafos.'
FROM collections c
JOIN collection_sections s
  ON s.collection_id = c.id AND s.slug = 'los-70'          -- ← década
JOIN albums al ON al.id = (
  SELECT a2.id
  FROM albums a2
  JOIN artists ar ON ar.id = a2.artist_id
  WHERE ar.name ILIKE 'Sui Generis'                         -- ← banda
    AND a2.title ILIKE 'Vida%'                              -- ← disco
  ORDER BY a2.release_date
  LIMIT 1
)
WHERE c.slug = 'historia-del-rock-argentino'
ON CONFLICT DO NOTHING;

-- 3) Editar el texto de una entry ya cargada.
UPDATE collection_entries
SET body_text = 'Texto nuevo.'
WHERE id = 'UUID-DE-LA-ENTRY';

-- 4) Texto de apertura de una década.
UPDATE collection_sections
SET intro_text = 'Párrafo de apertura de la época.'
WHERE slug = 'los-70'
  AND collection_id = (SELECT id FROM collections WHERE slug = 'historia-del-rock-argentino');

-- 5) Bloque narrativo suelto (sin disco), por ejemplo un hito histórico.
INSERT INTO collection_entries (collection_id, section_id, entry_type, title, body_text, year)
SELECT c.id, s.id, 'narrative', 'La Cueva', 'Texto del hito.', 1966
FROM collections c
JOIN collection_sections s ON s.collection_id = c.id AND s.slug = 'los-60'
WHERE c.slug = 'historia-del-rock-argentino';

-- 6) Ver lo cargado en una década, en el orden en que lo muestra la app.
SELECT COALESCE(al.release_date::text, e.year::text) AS fecha,
       ar.name AS banda, COALESCE(al.title, e.title) AS titulo, e.id
FROM collection_entries e
JOIN collection_sections s ON s.id = e.section_id
LEFT JOIN albums al ON al.id = e.album_id
LEFT JOIN artists ar ON ar.id = al.artist_id
WHERE s.slug = 'los-70'
ORDER BY al.release_date NULLS LAST, e.position;

-- 7) Borrar una entry.
DELETE FROM collection_entries WHERE id = 'UUID-DE-LA-ENTRY';
