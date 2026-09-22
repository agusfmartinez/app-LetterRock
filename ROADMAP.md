# Roadmap — LetterRock

Documento vivo: qué está hecho, qué está en curso y qué sigue. Se actualiza al
cerrar cada fase. El roadmap original (mayo 2026) quedó en el historial de git,
en el commit `473ed64`.

Última actualización: **2026-09-21**.

---

## Próximo

Ordenado por prioridad. Lo de arriba va primero.

1. **Terminar el rediseño** (ver "Pendientes del rediseño", abajo) y mergear
   `refactor/claude-design` a `main`.
2. **Deploy** — Vercel (frontend) + Render (backend). Nunca se hizo: nada salió
   de la máquina local. El primer deploy va a destapar CORS, variables de
   entorno, `service_role` y la cuota de YouTube desde otra IP; cuanto más
   crece el proyecto, más caro es ese primer choque.
   - Vercel: Root Directory `frontend`, build `npm run build`, output `dist`.
   - Render: Root Directory `backend`, start `npm start`.
3. **Secciones nuevas** (ver abajo). Van después del deploy: son funcionalidad
   nueva, y el rediseño tiene que quedar cerrado antes de sumarle páginas.

## Sala de escucha (preview público)

Va **inmediatamente después de listas y rankings** (decidido 2026-09-21).

Idea del 2026-09-21: una página simple para mostrar la app a gente real antes
de que esté completa. Buscador de discos, el tocadiscos 3D sonando el disco
entero, y la caja de opiniones.

Cuentas (decidido 2026-09-21):
- **Buscar y escuchar, libre**, sin cuenta.
- **Escribir y puntuar, también libre.** La cuenta se pide recién al tocar
  "Publicar": ahí aparece un modal para entrar o registrarse. Es **el mismo
  modal** que después usan las vistas previas sin sesión.
- **Dos formas de registrarse: Google, o mail y contraseña.** Revierte la
  decisión del 2026-08-27 de no usar login externo. Supabase Auth trae Google;
  se pide sólo nombre y mail, sin permisos de YouTube, así Google no exige
  revisión. Publicar la pantalla de consentimiento (en modo prueba acepta 100
  cuentas).
- **La opinión escrita no se pierde.** Con Google o con login dentro del modal
  no se sale de la página: al terminar se publica sola. Con registro nuevo
  por mail, el link de confirmación abre otra pestaña: la opinión queda
  guardada en el navegador y se publica al volver con sesión.
- El login de Google no afecta al reproductor: el embed de YouTube usa la
  sesión de YouTube del navegador, no la de LetterRock.

Factibilidad, por plataforma:

- **YouTube — viable y es la base.** La YouTube IFrame Player API reproduce
  temas completos, gratis, sin cuenta y sin gastar cuota de la Data API.
  Se controla por JavaScript (play, pausa, siguiente, en qué segundo va), así
  que el vinilo puede girar y marcar el surco al ritmo del reproductor. Usa
  los ids de video que ya guarda `media_links`. Condiciones: el reproductor
  tiene que quedar visible (mínimo 200×200 px, no se puede esconder detrás del
  vinilo), y sólo suenan los discos ya vinculados con YouTube.
- **YouTube Music — no hay cómo "conectar la cuenta".** No tiene API pública.
  Tampoco hace falta: el reproductor de arriba ya suena completo, y quien tiene
  Premium y la sesión de YouTube abierta lo escucha sin publicidad.
- **Spotify — no sirve para un preview público.** El Web Playback SDK
  reproduce temas completos en la página, pero exige que cada oyente tenga
  Premium, conecte su cuenta, y esté cargado a mano en el panel de la app:
  **máximo 5 personas** en modo desarrollo (ver "Límites ya verificados").
  El embed común de Spotify, sin conectar nada, suena 30 segundos por tema.

Requiere deploy: sin él no hay link para compartir. Puede ser el primer
deploy, más chico que la app entera.

## Pendientes del rediseño

Anotados el 2026-09-21. En este orden:

1. **Listas y rankings** — las páginas públicas de colección que quedan por
   rediseñar (la timeline ya está).
2. **Importar una playlist y que arme la lista o el ranking sola.** A
   investigar, va junto con la 1. Lo que hay que resolver:
   - Leer una playlist pública no necesita login en ninguna plataforma. En
     YouTube cuesta 1 unidad cada 50 temas. En Spotify, verificar que la
     lectura de playlists siga disponible para apps en modo desarrollo después
     de la migración de febrero de 2026 (las playlists de Spotify mismo, las
     editoriales, ya no se pueden leer desde 2024).
   - Cruzar cada tema con el catálogo. Desde Spotify es directo por
     `external_spotify_id`, pero sólo si el disco ya está cargado: los que no,
     habría que importar su artista primero. Desde YouTube es por título, como
     la vinculación de discografías.
   - Qué pasa con lo que no se encuentra: descartarlo, o listarlo para cargarlo
     a mano.
   - En un ranking, el orden de la playlist pasa a ser la posición.
3. **Pensarla como app, no como web.**
   - El footer sólo en la home sin sesión (la landing). Adentro de la app no va.
   - **Sin sesión, sólo la home.** Decidido (2026-09-21): las demás páginas
     muestran una vista previa y, al scrollear, un modal que pide entrar o
     registrarse, como Instagram o Facebook. Así un link compartido en redes
     no rebota contra un login seco.
     **Que no se pueda saltear:** un modal en el navegador siempre se puede
     borrar desde las herramientas de desarrollo. La protección de verdad va
     en los datos: sin sesión, el servidor manda sólo lo que entra en la vista
     previa (por ejemplo, las primeras entradas de una colección), y las
     políticas RLS de Supabase no le dejan a `anon` leer el resto. El modal es
     la invitación; el candado es la base.
   - **Home con sesión tipo feed de red social**: reordenarla alrededor del
     feed de actividad y posteos.
4. **Menú lateral desde el avatar** (arriba a la derecha): hoy no hay menú y
   las opciones quedan muy escondidas. Perfil, mis colecciones, favoritos,
   ajustes, panel para editores, salir.
5. **Perfil propio** — rediseñar la página.
6. **Footer** — rehacerlo:
   - Créditos de las fuentes: hoy nombra sólo a MusicBrainz. Falta Spotify,
     YouTube, Wikipedia. Revisar qué exige cada una (Spotify tiene reglas de
     atribución de marca; MusicBrainz y Wikipedia piden mención por licencia).
   - Links a redes sociales de LetterRock.
   - Contacto / soporte.

## Pendientes chicos

- Borrar lo que quedó sin uso al sacar "Crear playlist en Spotify":
  `pages/SpotifyCallback.jsx` (y su ruta `/spotify-callback`),
  `services/spotifyPlaylist.ts`, `services/spotifyAuth.ts`.
- `VITE_API_URL=http://localhost:3000` rompe la búsqueda al abrir la app desde el
  teléfono en la red local. Pasar a una ruta relativa (`/api`) con proxy de Vite.
- Borrar `.claude/memory/` del repo: es una copia vieja (junio) de notas que ya
  viven en este archivo.

## Decisiones pendientes

- **Playlists generadas desde una cuenta de Spotify de LetterRock.** En vez de
  pedirle permiso a cada visitante (Spotify permite 5 usuarios por app en modo
  desarrollo), crear la playlist una sola vez por colección en una cuenta
  propia, con el refresh token en el backend. Requiere una cuenta Premium
  aparte. Encaja con el `playlist_url` que ya tienen colecciones y épocas.

## Secciones nuevas

La app hoy es corta: buscador y colecciones. Ideas del 2026-09-21, sin orden
entre ellas todavía:

- **Efemérides.** Una página diaria con los aniversarios del día: discos que
  cumplen años, bandas que se formaron. Decidido: **sólo datos con día, mes y
  año**; un disco del que Spotify sabe sólo el año no entra. La materia prima
  de los discos ya está (`albums.release_date` con su precisión). Falta
  pensar: `artists.formed_year` guarda sólo el año, y no hay fechas de
  nacimiento ni de muerte de músicos — MusicBrainz las tiene en el
  `life-span` de cada persona, pero no se están guardando.
- **Shows y recitales** con la API de Setlist.fm: fecha, lugar, ciudad y temas
  tocados. Requiere API key.
- **Galería**: imágenes para compartir.
- **Frases de canciones**: compartir un fragmento de letra, probablemente como
  un tipo de posteo. Depende de las letras.

## Ideas sin priorizar

- **Letras.** El panel de la canción ya reserva el lugar. Mostrar la letra
  completa tiene problemas de derechos: fragmento + link, o Musixmatch. Las
  frases para compartir dependen de esto.
- **Más plataformas**: Apple Music, Tidal, Deezer.

---

## En curso — Rediseño (`refactor/claude-design`, desde `cc1be64`)

Paleta oscura de rock, tipografía y redondeos del diseño de Claude Design.

- Home con feed en sesión y hero sin sesión.
- **Pila 3D** de discos en la página del artista (`shelf3d.js`) y **vinilo 3D**
  (`vinyl3d.js`): el surco del tema elegido se marca, el disco gira mientras
  suena.
- **Página del álbum con modo canción** (`?tema=`): cambiar de tema no navega a
  otra página. `/track/:id` redirige ahí. Discos dobles separados en Disco 1 y
  Disco 2.
- Opiniones iguales en todas las páginas: formulario arriba, lista abajo, y
  "Opiniones sobre **X**" con el nombre en naranja.
- Buscador único: artistas arriba, usuarios abajo (se fue `/usuarios`).
- Panel de administración rehecho: Descubrir, Catálogo, Usuarios, Colecciones,
  edición de artista, álbum, colección y época. Menú `⋯` para acciones poco
  frecuentes, estados como etiquetas, dos columnas en escritorio.
- Timeline: formación con foto de cada integrante, índice de años flotante en el
  teléfono, cabecera del disco antes de la portada en el teléfono, navegación
  entre épocas arriba y abajo.
- Panel "Escuchar" sólo con links: se fue crear la playlist en la cuenta del
  visitante y copiar URIs.
- Bio de Wikipedia buscada por Wikidata (vía MusicBrainz) para no traer el
  artículo equivocado ("Almendra" traía la fruta).

---

## Hecho

### Base — fases 1.x (mayo–agosto)
- Setup React + Vite + Tailwind, Express, Supabase con RLS.
- Búsqueda de artistas en MusicBrainz (filtro AR/UY y rock), ingesta de
  discos y temas desde Spotify, bio de Wikipedia.
- Autenticación y perfiles (`5473b95`).
- Reviews y comentarios (`32b62d3` y siguientes); detalles migrados a
  TanStack Query (`563070f`).
- Favoritos y feed de actividad (`e1aabd9`, `9997a54`).

### Roles y colecciones — fases 2.x (agosto)
- 2.1 Roles usuario / editor / admin, con un trigger que impide auto-ascenderse
  (`fbbc424`).
- 2.2 Colecciones: timelines, listas y rankings en un solo modelo (`923ea0a`).
- 2.3 Panel de editor de colecciones (`4c41792`).
- 2.4 Timeline agrupada por año, con índice lateral (`0d5c857`).
- 2.5 YouTube Music: `media_links`, vinculación por el canal "Topic" del
  artista, reproducciones reales, reproductor Spotify / YouTube (`5adf537`,
  `e1fcb01`).

### Catálogo — fases 3.x (agosto)
- 3.1 CRUD de artistas, discos y temas; `manual_fields` protege las
  correcciones a mano de la próxima ingesta (`7bbc6e2`).
- 3.2 Ocultar en vez de borrar, alta manual de discos y temas (`fd69f5c`).
- 3.3 Formación de las bandas desde MusicBrainz, editable (`8d8142a`).
- 3.4 Descubrir e importar artistas en lote (`c04f1d3`).

### Comunidad — fases 4.x (agosto)
- 4.1 Subida de imágenes a Supabase Storage (`16b222e`).
- 4.2 Índice público de colecciones (`eb14d9f`).
- 4.3 Seguir usuarios, directorio y feed de seguidos (`a23288d`).
- 4.4 Editor de entradas unificado para las tres clases de colección (`3153b4e`).

### Social — fases 5.x (agosto–septiembre)
Plan de 6 puntos acordado el 2026-08-27, completo:
- 5.1 Colecciones creadas por usuarios, con moderación de admins (`3f16283`).
- 5.1.1 Puntuación y comentarios en colecciones y épocas (`13d8be5`). Decidido
  **no** ordenar por puntuación: con pocos votos gana el que se autovota primero.
- 5.2 Entradas de tipo canción (`7c3c0ec`).
- 5.3 Playlist adjunta por URL + playlist derivada de las entradas (`24e82a9`).
- 5.4 Posteos (`cdf49c3`).
- 5.5 Onboarding con bandas favoritas y usuarios sugeridos por afinidad
  (`b99f9d0`).

---

## Límites ya verificados

Para no volver a investigarlos.

- **Login externo descartado.** Nada de OAuth de Google ni de Spotify.
- **Spotify**: 5 usuarios por app en modo desarrollo; el Extended Quota Mode
  exige empresa y 250k usuarios activos. Crear una playlist exige token de
  usuario, siempre. El dueño de la app necesita Premium activo.
- **YouTube Data API**: 10.000 unidades por día. Buscar cuesta 100; leer el
  catálogo de un canal, ~20; refrescar reproducciones, 1 cada 50 temas. Presupuesto
  interno de 9.000. Convertir playlists de Spotify a YouTube es inviable por
  cuota; al revés, sí.
- **YouTube Music** no tiene API pública ni embed propio: se incrusta el video.
  Las playlists auto-generadas de álbumes no aparecen en la búsqueda.
- **Spotify no publica reproducciones** en la API pública: el número sale sólo
  de YouTube.
- Sin Odesli ni Last.fm (Odesli no devuelve YouTube Music).
- Migraciones: viven en `migrations/` y se corren a mano en el SQL Editor de
  Supabase.
