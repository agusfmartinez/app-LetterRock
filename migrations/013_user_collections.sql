-- ============================================
-- 013 — Las colecciones dejan de ser sólo del editor
--
-- Hasta ahora `collections` era contenido del sitio: sólo un editor las creaba y
-- las policies eran `is_editor()` a secas. A partir de acá cualquiera con cuenta
-- puede armar su timeline, su lista o su ranking, y los admins moderan.
--
-- Esto además borra `lists` y `list_items`, que existían desde el schema inicial
-- con sus policies y nunca tuvieron ni una fila ni una pantalla: eran el mismo
-- concepto que una colección de tipo `list`, con otro dueño. Dos modelos para lo
-- mismo se terminan pareciendo cada vez menos, y hay que mantener los dos.
--
-- Correr en el SQL Editor de Supabase.
-- ============================================

-- ============================================
-- 1. Columnas nuevas
--
-- `is_official` marca las de la app, que van fijadas arriba del índice. Se
-- guarda y no se deduce del rol de quien la creó: si mañana ese usuario deja de
-- ser editor, la Historia del rock argentino no tiene por qué dejar de ser
-- oficial. Y `created_by` de las viejas es NULL, así que no habría de dónde
-- deducirlo.
--
-- `hidden` es la moderación, con el mismo criterio que en `artists`: bajar algo
-- sin borrarlo, para poder revertir.
-- ============================================
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden      BOOLEAN NOT NULL DEFAULT FALSE;

-- Lo que existía hasta hoy lo cargó el editor: es contenido de la app.
UPDATE collections SET is_official = TRUE WHERE is_official = FALSE;

CREATE INDEX IF NOT EXISTS idx_collections_listing
  ON collections(is_official DESC, created_at DESC)
  WHERE is_published AND NOT hidden;

-- ============================================
-- 2. Quién puede tocar qué
--
-- Tres niveles: cualquiera lee lo publicado, el dueño maneja lo suyo, el editor
-- puede todo. `created_by` pasa a ser la clave de permisos y ya no un dato
-- informativo.
-- ============================================
DROP POLICY IF EXISTS "Published collections are public" ON collections;
DROP POLICY IF EXISTS "Editors manage collections" ON collections;

CREATE POLICY "collections_read" ON collections
  FOR SELECT USING (
    (is_published AND NOT hidden)
    OR created_by = auth.uid()
    OR is_editor()
  );

-- El alta exige firmar con el propio id: sin esto alguien podría crear una
-- colección a nombre de otro y después no poder ni editarla ni borrarla.
CREATE POLICY "collections_insert_own" ON collections
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "collections_update_own" ON collections
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_editor())
  WITH CHECK (created_by = auth.uid() OR is_editor());

CREATE POLICY "collections_delete_own" ON collections
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_admin());

-- ============================================
-- 3. Fijado y moderación, sólo para editores
--
-- RLS no puede comparar el valor viejo con el nuevo, así que la policy de UPDATE
-- no alcanza: dejaría al dueño marcarse como oficial o desocultarse solo. Mismo
-- problema y misma solución que la escalada de roles en la 001.
-- ============================================
CREATE OR REPLACE FUNCTION enforce_collection_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.is_official IS DISTINCT FROM OLD.is_official
      OR NEW.hidden IS DISTINCT FROM OLD.hidden)
     AND NOT is_editor() THEN
    RAISE EXCEPTION 'Sólo un editor puede fijar u ocultar una colección';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS collections_enforce_flags ON collections;
CREATE TRIGGER collections_enforce_flags
  BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION enforce_collection_flags();

-- El alta con `is_official` en TRUE se corta por separado: en un INSERT no hay
-- OLD contra qué comparar.
CREATE OR REPLACE FUNCTION enforce_collection_insert_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.is_official OR NEW.hidden) AND NOT is_editor() THEN
    RAISE EXCEPTION 'Sólo un editor puede crear una colección oficial';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS collections_enforce_insert_flags ON collections;
CREATE TRIGGER collections_enforce_insert_flags
  BEFORE INSERT ON collections
  FOR EACH ROW EXECUTE FUNCTION enforce_collection_insert_flags();

-- ============================================
-- 4. Secciones y entradas siguen a su colección
--
-- El permiso no vive en la fila sino en la colección de la que cuelga: quien
-- puede editar la colección puede editar lo que tiene adentro.
-- ============================================
CREATE OR REPLACE FUNCTION can_edit_collection(target UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = target AND (c.created_by = auth.uid() OR is_editor())
  );
$$;

CREATE OR REPLACE FUNCTION can_read_collection(target UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = target
      AND ((c.is_published AND NOT c.hidden) OR c.created_by = auth.uid() OR is_editor())
  );
$$;

DROP POLICY IF EXISTS "Sections follow collection visibility" ON collection_sections;
DROP POLICY IF EXISTS "Editors manage sections" ON collection_sections;

CREATE POLICY "sections_read" ON collection_sections
  FOR SELECT USING (can_read_collection(collection_id));

CREATE POLICY "sections_write" ON collection_sections
  FOR ALL TO authenticated
  USING (can_edit_collection(collection_id))
  WITH CHECK (can_edit_collection(collection_id));

DROP POLICY IF EXISTS "Entries follow collection visibility" ON collection_entries;
DROP POLICY IF EXISTS "Editors manage entries" ON collection_entries;

CREATE POLICY "entries_read" ON collection_entries
  FOR SELECT USING (can_read_collection(collection_id));

CREATE POLICY "entries_write" ON collection_entries
  FOR ALL TO authenticated
  USING (can_edit_collection(collection_id))
  WITH CHECK (can_edit_collection(collection_id));

-- ============================================
-- 5. Se van `lists` y `list_items`
--
-- Verificado antes de escribir esto: 0 filas en las dos. Eran el mismo concepto
-- que una colección de tipo `list`; ahora que las colecciones tienen dueño, no
-- hay nada que las distinga.
-- ============================================
DROP TABLE IF EXISTS list_items;
DROP TABLE IF EXISTS lists;
