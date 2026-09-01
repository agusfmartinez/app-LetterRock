-- ============================================
-- 014 — Puntuar y comentar colecciones
--
-- `reviews`, `comments` y `favorites` ya son polimórficas: guardan `entity_type`
-- + `entity_id` y sirven para artistas, discos y canciones. Lo único que las
-- ataba a esos tres era el CHECK.
--
-- Ahora que las colecciones las arma cualquiera, tiene sentido opinar sobre
-- ellas: una lista curada es tan opinable como un disco.
--
-- DECIDIDO CON EL USUARIO: el índice NO se ordena por puntuación. Con pocos
-- votos el promedio lo gana el que se autovota primero, así que las de la
-- comunidad van por más recientes. La nota se muestra, no ordena.
--
-- Correr en el SQL Editor de Supabase.
-- ============================================

-- Postgres no permite modificar un CHECK: hay que sacarlo y volver a ponerlo.
-- Los nombres son los que genera solo al declararlo inline en la tabla.
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_entity_type_check;
ALTER TABLE reviews ADD CONSTRAINT reviews_entity_type_check
  CHECK (entity_type IN ('artist', 'album', 'track', 'collection'));

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_entity_type_check;
ALTER TABLE comments ADD CONSTRAINT comments_entity_type_check
  CHECK (entity_type IN ('artist', 'album', 'track', 'collection'));

-- Favoritos también: guardar una colección ajena para volver a ella es lo mismo
-- que guardar un disco, y el botón ya es genérico.
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_entity_type_check;
ALTER TABLE favorites ADD CONSTRAINT favorites_entity_type_check
  CHECK (entity_type IN ('artist', 'album', 'track', 'collection'));
