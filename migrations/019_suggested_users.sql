-- ============================================
-- 019 — A quién seguir, por afinidad
--
-- El arranque en frío de los follows: alguien recién registrado no sigue a
-- nadie, y hasta ahora el directorio de /usuarios sólo ofrece "los últimos en
-- sumarse", que no dice nada de con quién compartís gustos.
--
-- La idea: si dos personas marcaron las mismas bandas como favoritas, es
-- más probable que valga la pena seguirse. El onboarding le pide a quien se
-- registra sus bandas favoritas, y esta función usa esos favoritos para
-- sugerir gente afín.
--
-- Va como función en Postgres y no como conteo en el cliente: contar
-- coincidencias es un GROUP BY, y PostgREST no arma agregaciones arbitrarias
-- sobre una tabla — necesitaría traerse todas las filas de favorites en juego
-- y sumarlas a mano en el navegador.
--
-- Correr en el SQL Editor de Supabase.
-- ============================================

CREATE OR REPLACE FUNCTION suggested_users(p_limit INT DEFAULT 10)
RETURNS TABLE(user_id UUID, shared_count INT)
LANGUAGE sql
STABLE
AS $$
  -- Se apoya en auth.uid() y no en un parámetro con el id de quien pregunta:
  -- así nadie puede pedir la afinidad calculada para otra persona. Sin
  -- SECURITY DEFINER porque no hace falta: el SELECT de `favorites` y de
  -- `follows` ya es público, así que la función no necesita saltarse RLS para
  -- leer nada que no pudiera leer igual con dos consultas sueltas.
  SELECT mine.other_user AS user_id, COUNT(*)::int AS shared_count
  FROM (
    SELECT f2.user_id AS other_user
    FROM favorites f1
    JOIN favorites f2
      ON f2.entity_type = f1.entity_type
     AND f2.entity_id = f1.entity_id
     AND f2.user_id <> f1.user_id
    WHERE f1.user_id = auth.uid()
      AND f1.entity_type = 'artist'
      -- A quien ya seguís no hace falta sugerírtelo: la sugerencia es para
      -- gente nueva, no para confirmar lo que ya hiciste.
      AND NOT EXISTS (
        SELECT 1 FROM follows fo
        WHERE fo.follower_id = auth.uid() AND fo.user_id = f2.user_id
      )
  ) AS mine
  GROUP BY mine.other_user
  ORDER BY shared_count DESC
  LIMIT p_limit;
$$;

-- Sólo con sesión: sin favoritos propios (auth.uid() nulo) no hay nada que
-- calcular, y de paso evita que se use como una forma indirecta de barrer
-- toda la tabla de favoritos sin estar logueado.
REVOKE ALL ON FUNCTION suggested_users(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION suggested_users(INT) TO authenticated;
