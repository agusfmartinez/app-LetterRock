# Roadmap — LetterRock

Documento vivo: qué está hecho, qué está en curso y qué sigue. Se actualiza al
cerrar cada fase. El roadmap original (mayo 2026) quedó en el historial de git,
en el commit `473ed64`.

Última actualización: **2026-09-21**.

---

## Próximo

Ordenado por prioridad. Lo de arriba va primero.

1. **Cerrar el rediseño y mergear `refactor/claude-design` a `main`.**
2. **Deploy** — Vercel (frontend) + Render (backend). Nunca se hizo: nada salió
   de la máquina local. El primer deploy va a destapar CORS, variables de
   entorno, `service_role` y la cuota de YouTube desde otra IP; cuanto más
   crece el proyecto, más caro es ese primer choque.
   - Vercel: Root Directory `frontend`, build `npm run build`, output `dist`.
   - Render: Root Directory `backend`, start `npm start`.

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

## Ideas sin priorizar

- **Shows y setlists** con la API de Setlist.fm: fecha, lugar y temas tocados.
- **Letras.** El panel de la canción ya reserva el lugar. Mostrar la letra
  completa tiene problemas de derechos: fragmento + link, o Musixmatch.
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
