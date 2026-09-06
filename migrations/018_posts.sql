-- ============================================
-- 018 — Posteos
--
-- Hasta acá el feed era un subproducto: reviews, favoritos y comentarios que
-- alguien hizo con otra intención y que de paso se veían en la portada. Nadie
-- podía escribir *para* el feed.
--
-- Un posteo es eso: texto suelto, opcionalmente colgado de algo del catálogo
-- ("escuchando esto"). Sin puntaje, porque puntuar ya tiene su lugar, y una
-- opinión sobre un disco es una review, no un posteo.
--
-- La referencia al catálogo es polimórfica (`entity_type` + `entity_id`, sin
-- FK), igual que en `reviews`, `favorites` y `comments`: es el precio de que una
-- misma tabla pueda apuntar a bandas, discos, temas, colecciones y épocas. El
-- lado bueno es que `fetchEntities` del front ya sabe resolverla.
--
-- Correr en el SQL Editor de Supabase.
-- ============================================

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,

  -- Los dos NULL cuando el posteo no cuelga de nada: se puede escribir sin
  -- adjuntar. El CHECK exige que vengan de a dos o ninguno, para que no quede
  -- un tipo sin id ni un id sin tipo.
  entity_type VARCHAR(20)
    CHECK (entity_type IN ('artist', 'album', 'track', 'collection', 'collection_section')),
  entity_id UUID,
  CONSTRAINT posts_entity_check CHECK (
    (entity_type IS NULL AND entity_id IS NULL)
    OR (entity_type IS NOT NULL AND entity_id IS NOT NULL)
  ),

  -- Misma moderación que en `collections` y `artists`: bajar sin borrar, para
  -- poder revertir.
  hidden BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- El feed pide "los últimos N, no ocultos": el índice parcial cubre justo eso.
CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts(created_at DESC) WHERE NOT hidden;
-- Y el perfil pide "los de esta persona", que es la otra única lectura.
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_entity ON posts(entity_type, entity_id);

CREATE OR REPLACE TRIGGER posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS
--
-- Un posteo oculto lo sigue viendo su autor: si desaparece sin dejar rastro, la
-- persona lo vuelve a escribir. Que lo vea tachado es lo que hace que la
-- moderación se entienda.
-- ============================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_read" ON posts;
CREATE POLICY "posts_read" ON posts
  FOR SELECT USING (NOT hidden OR user_id = auth.uid() OR is_editor());

-- Firmar con el propio id, como en `collections`: sin esto se podría postear a
-- nombre de otro.
DROP POLICY IF EXISTS "posts_insert_own" ON posts;
CREATE POLICY "posts_insert_own" ON posts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "posts_update_own" ON posts;
CREATE POLICY "posts_update_own" ON posts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_editor())
  WITH CHECK (user_id = auth.uid() OR is_editor());

DROP POLICY IF EXISTS "posts_delete_own" ON posts;
CREATE POLICY "posts_delete_own" ON posts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- RLS no puede comparar OLD contra NEW, así que la policy de UPDATE por sí sola
-- dejaría a cualquiera desocultarse el propio posteo. Mismo problema y misma
-- solución que en las colecciones (013) y en la escalada de roles (001).
CREATE OR REPLACE FUNCTION enforce_post_hidden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.hidden IS DISTINCT FROM OLD.hidden AND NOT is_editor() THEN
    RAISE EXCEPTION 'Sólo un editor puede ocultar o restaurar un posteo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_enforce_hidden ON posts;
CREATE TRIGGER posts_enforce_hidden
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION enforce_post_hidden();

CREATE OR REPLACE FUNCTION enforce_post_insert_hidden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.hidden AND NOT is_editor() THEN
    RAISE EXCEPTION 'Sólo un editor puede ocultar un posteo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_enforce_insert_hidden ON posts;
CREATE TRIGGER posts_enforce_insert_hidden
  BEFORE INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION enforce_post_insert_hidden();
