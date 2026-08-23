-- ============================================
-- FASE 2.1 — ROLES DE USUARIO
-- Correr en el SQL Editor de Supabase.
-- ============================================

-- 1. Columna role
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'editor', 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- 2. Helpers de rol
-- SECURITY DEFINER + search_path fijo: se pueden usar dentro de policies
-- sin recursión de RLS ni depender del search_path del caller.
-- ============================================

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_editor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(current_user_role() IN ('editor', 'admin'), FALSE);
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(current_user_role() = 'admin', FALSE);
$$;

-- ============================================
-- 3. Anti escalada de privilegios
-- La policy "Users can update own profile" permite que un usuario edite su
-- propia fila. Sin este trigger podría hacer role = 'admin' desde el cliente.
-- RLS no puede comparar OLD vs NEW, por eso va como trigger.
-- auth.uid() IS NULL = service_role / SQL Editor → se permite (bootstrap).
-- ============================================

CREATE OR REPLACE FUNCTION enforce_role_change_is_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT is_admin() THEN
    RAISE EXCEPTION 'No autorizado para cambiar el rol de un usuario';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_enforce_role_change ON users;
CREATE TRIGGER users_enforce_role_change
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION enforce_role_change_is_admin();

-- ============================================
-- 4. Los admins pueden editar cualquier perfil (para asignar roles)
-- ============================================

DROP POLICY IF EXISTS "Admins can update any profile" ON users;
CREATE POLICY "Admins can update any profile" ON users
  FOR UPDATE USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 5. BOOTSTRAP — dejar el primer admin
-- Correr esta línea a mano cambiando el username:
-- ============================================

-- UPDATE users SET role = 'admin' WHERE username = 'TU_USUARIO';
