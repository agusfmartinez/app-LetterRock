-- ============================================
-- FASE 3.3.1 — CLAVE DE ETAPA: AGREGAR LA BANDA
-- ============================================
--
-- `mb_key` era `músico:desde:hasta`. Mirando la ficha de una banda alcanza,
-- porque el músico cambia en cada relación. Mirando la de una persona no: el
-- músico es siempre el mismo, así que dos etapas sin fecha —Charly García en
-- Serú Girán y en La Máquina de Hacer Pájaros— daban la misma clave y una de
-- las dos se perdía antes de llegar a la base.
--
-- La clave nueva es `músico:banda:desde:hasta`, que identifica la relación sin
-- depender de desde qué ficha se la mire.
--
-- Las filas ya importadas tienen la clave vieja: la próxima importación no las
-- reconocería y agregaría duplicados en vez de actualizarlas. Esta migración
-- las saca del camino.

-- 1. Lo que el editor corrigió a mano se queda, pero deja de estar atado a
--    MusicBrainz: sin `mb_key` la importación no lo pisa ni choca con él.
UPDATE artist_members
SET source = 'manual', mb_key = NULL
WHERE mb_key IS NOT NULL
  AND array_length(string_to_array(mb_key, ':'), 1) = 3
  AND array_length(manual_fields, 1) > 0;

-- 2. El resto es copia literal de MusicBrainz y se regenera importando de nuevo.
DELETE FROM artist_members
WHERE source = 'musicbrainz'
  AND mb_key IS NOT NULL
  AND array_length(string_to_array(mb_key, ':'), 1) = 3;

-- Después de correr esto: volvé a importar la formación de cada banda que ya
-- hayas cargado. Es una llamada a MusicBrainz por artista, sin costo de cuota.
