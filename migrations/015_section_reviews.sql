-- ============================================
-- 015 — Opinar sobre una época
--
-- En una timeline, la página de la colección es una grilla de épocas: no hay
-- nada ahí sobre lo que opinar, porque lo que se lee está adentro de cada una.
-- Lo opinable es "Los 70", no "Historia del rock argentino".
--
-- Una lista y un ranking no tienen épocas, así que ahí la opinión sigue en la
-- colección. Cada tipo la pone donde está el contenido.
--
-- Correr en el SQL Editor de Supabase. Reemplaza los CHECK de la 014.
-- ============================================

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_entity_type_check;
ALTER TABLE reviews ADD CONSTRAINT reviews_entity_type_check
  CHECK (entity_type IN ('artist', 'album', 'track', 'collection', 'collection_section'));

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_entity_type_check;
ALTER TABLE comments ADD CONSTRAINT comments_entity_type_check
  CHECK (entity_type IN ('artist', 'album', 'track', 'collection', 'collection_section'));

ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_entity_type_check;
ALTER TABLE favorites ADD CONSTRAINT favorites_entity_type_check
  CHECK (entity_type IN ('artist', 'album', 'track', 'collection', 'collection_section'));
