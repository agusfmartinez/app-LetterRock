# 🎸 Roadmap — Letterboxd de Rock Nacional

## El insight clave
Tu app **no es un catálogo de música**. Es una **red social donde el contenido es música**.

Sin reviews, ratings, listas y actividad social → no hay producto.

---

## 📋 Estructura del Roadmap

Dividido en **4 TRAMOS** que se pueden ejecutar secuencialmente.
Cada tramo tiene **tareas claras, no técnicas** (así otro agente puede ejecutarlas).

---

# TRAMO 1: MVP Social Base (6-8 semanas)

**Objetivo**: Tener una app funcionando donde se puedan buscar bandas, ver álbumes y dejar opiniones.

## Fase 1.1 — Setup & Infraestructura Base

| Tarea | Descripción | Dependencias | Estimado |
|-------|-------------|--------------|----------|
| Crear proyecto Supabase | Base de datos + auth | Ninguna | 2h |
| Crear repo Git | Frontend + Backend | Ninguna | 1h |
| Configurar React + Router | Proyecto frontend | Git | 3h |
| Crear estructura de carpetas | Componentes, páginas, services | Proyecto React | 1h |
| Documentar arquitectura simple | Diagrama de cómo fluyen los datos | Todas las anteriores | 2h |

**Resultado**: Entorno listo para desarrollar, carpetas organizadas, primera rama en Git.

---

## Fase 1.2 — Modelo de Datos (Sólo lo que necesitas para MVP)

### Tablas a crear en Supabase

```
artists
├─ id (UUID)
├─ external_mb_id (string)
├─ external_spotify_id (string, nullable)
├─ name (string)
├─ slug (string, unique)
├─ country (string)
├─ bio (text, nullable)
├─ image_url (string, nullable)
├─ formed_year (int, nullable)
├─ created_at (timestamp)

albums
├─ id (UUID)
├─ artist_id (FK → artists)
├─ external_mb_release_group_id (string)
├─ external_spotify_id (string, nullable)
├─ title (string)
├─ slug (string)
├─ release_date (date)
├─ cover_url (string, nullable)
├─ album_type (enum: studio, live, compilation, etc)
├─ created_at (timestamp)

tracks
├─ id (UUID)
├─ album_id (FK → albums)
├─ external_mb_recording_id (string)
├─ external_spotify_id (string, nullable)
├─ title (string)
├─ duration_ms (int)
├─ track_number (int)
├─ disc_number (int)
├─ lyrics_status (enum: none, external_only, partial)
├─ created_at (timestamp)

users
├─ id (UUID, from auth)
├─ username (string, unique)
├─ email (string)
├─ avatar_url (string, nullable)
├─ bio (text, nullable)
├─ created_at (timestamp)

reviews
├─ id (UUID)
├─ user_id (FK → users)
├─ entity_type (enum: artist, album, track)
├─ entity_id (UUID, polymorphic)
├─ rating (int: 1-5)
├─ text (text)
├─ created_at (timestamp)
├─ updated_at (timestamp)

comments
├─ id (UUID)
├─ user_id (FK → users)
├─ entity_type (enum: artist, album, track)
├─ entity_id (UUID, polymorphic)
├─ body (text)
├─ created_at (timestamp)
├─ updated_at (timestamp)

favorites
├─ id (UUID)
├─ user_id (FK → users)
├─ entity_type (enum: artist, album, track)
├─ entity_id (UUID, polymorphic)
├─ created_at (timestamp)
```

### Políticas de acceso (RLS)

- Lecturas públicas de artistas, álbumes, tracks, reviews
- Escritura solo si autenticado (para reviews, comments, favorites)
- Usuarios solo pueden editar/borrar sus propios datos

| Tarea | Descripción | Resultado |
|-------|-------------|-----------|
| Crear todas las tablas | SQL scripts en Supabase | Tablas listas |
| Crear índices básicos | En name, slug, artist_id, user_id | Búsquedas rápidas |
| Configurar RLS | Políticas simples | Acceso seguro |
| Crear helpers de acceso | Funciones SQL para consultas comunes | Queries optimizadas |

**Resultado**: Base de datos lista, optimizada, con acceso seguro.

---

## Fase 1.3 — Ingesta de Catálogo (MusicBrainz)

### Qué necesitas

- Un **small backend** (Node/Express) que haga batch jobs
- Integración con **MusicBrainz API**
- Lógica de **normalización y deduplicación**

### El flujo

1. Usuario busca "Soda Stereo" en la app
2. Backend verifica si existe en DB
3. Si no existe → consulta MusicBrainz
4. Guarda artista, álbumes y tracks en DB
5. Siguiente búsqueda → sirve desde DB (rápido)

### Tareas

| Tarea | Descripción | Dependencias |
|-------|-------------|--------------|
| Crear servicio de búsqueda MusicBrainz | GET /api/search/artist | Backend setup |
| Crear servicio de ingesta artista | GET /api/search/artist → guardar en DB | Modelo de datos |
| Crear servicio de ingesta discografía | Traer álbumes y tracks | Servicio artista |
| Implementar deduplicación | Evitar artistas/álbumes duplicados | DB y helpers |
| Manejar rate limits | Respetar 1 req/seg de MusicBrainz | Todos los anteriores |
| Crear página de búsqueda (frontend) | Input + lista de resultados | React + router |

**Resultado**: Puedes buscar cualquier banda argentina y ver su discografía.

---

## Fase 1.4 — Pantallas Base (Frontend)

### Pantallas a crear

| Pantalla | Componentes | Funcionalidad |
|----------|-------------|---------------|
| **Home** | Hero + trending bands + latest reviews | Mostrar comunidad |
| **Search** | Input + resultados (artistas) | Buscar bandas |
| **Artist Detail** | Info artista + discografía + reviews | Ver banda y comentarios |
| **Album Detail** | Portada + tracklist + reviews | Ver álbum y opiniones |
| **Track Detail** | Info track + comentarios | Ver canción y comentarios |
| **Auth** | Login / Signup | Crear cuenta |
| **Profile** | Datos usuario + favoritos + reviews | Ver perfil |

### Componentes reutilizables

- `ArtistCard` — thumbnail artista
- `AlbumCard` — portada + título
- `TrackRow` — canción en lista
- `RatingStars` — selector 1-5 estrellas
- `ReviewCard` — muestra review
- `CommentThread` — lista de comentarios

| Tarea | Descripción |
|-------|-------------|
| Crear layout base | Navbar + footer + contenedor | 
| Crear todas las pantallas | Estructura HTML sin lógica |
| Crear componentes reutilizables | Cartas, botones, inputs |
| Conectar con backend | Fetch de datos |
| Manejar loading/error | Estados visuales |

**Resultado**: App navegable, conexión entre pantallas funcionando.

---

## Fase 1.5 — Autenticación & Usuarios

| Tarea | Descripción |
|-------|-------------|
| Configurar auth de Supabase | Google/Email login |
| Crear página de signup/login | UI + flujo |
| Crear tabla users extendida | Perfil del usuario |
| Middleware de autenticación | Rutas protegidas |
| Página de perfil usuario | Ver datos, favoritos, reviews |

**Resultado**: Usuarios pueden registrarse y loguear.

---

## Fase 1.6 — Reviews & Comments (Core social)

### Funcionalidad

- User puede dar **rating 1-5** a artista/álbum/canción
- User puede escribir **review** (texto largo)
- User puede dejar **comentarios** en cualquier entidad

### Tareas

| Tarea | Descripción |
|-------|-------------|
| Crear UI de rating | Selector de estrellas |
| Crear form de review | Textarea + botón publicar |
| Crear form de comentario | Textarea chico + botón |
| Listar reviews | Mostrar todas con autor + fecha |
| Listar comentarios | Mostrar hilo |
| Editar/borrar propio contenido | Solo el autor puede |
| Mostrar promedio de ratings | En cada entidad |

**Resultado**: Puedes dejar opiniones en cualquier cosa.

---

## Fase 1.7 — Favoritos & Actividad Básica

| Tarea | Descripción |
|-------|-------------|
| Crear botón "favorito" | Marcar artista/álbum/track |
| Mostrar favoritos en perfil | Listado personal |
| Crear actividad social | "X puntuó Y con 5 estrellas" |
| Feed básico | Mostrar últimas reviews |

**Resultado**: MVP social mínimo. 

**ACA TERMINA EL TRAMO 1 Y YA TENES PRODUCTO USABLE**

---

# TRAMO 2: Social & Community (4-6 semanas)

Asumiendo TRAMO 1 completo.

## Fase 2.1 — Listas (tipo Letterboxd)

| Tarea | Descripción |
|-------|-------------|
| Crear modelo de listas | Tabla lists + list_items |
| Crear UI para crear lista | Form: nombre, descripción, público/privado |
| Implementar agregar items | Drag & drop o botón |
| Página de lista pública | Ver lista ajena |
| Mostrar listas en perfil | Listado |

**Ejemplos**: "Top 10 discos del rock argentino", "Mejores debuts de los 90"

---

## Fase 2.2 — Seguir Usuarios

| Tarea | Descripción |
|-------|-------------|
| Crear tabla follows | user_id + follower_id |
| Botón "seguir" en perfil | Toggle follow/unfollow |
| Feed personalizado | Mostrar actividad de seguidos |

---

## Fase 2.3 — Likes & Mejor Social

| Tarea | Descripción |
|-------|-------------|
| Sistema de likes en reviews | Contar likes |
| Rankings globales | "Mejores álbumes", "Más reseñados" |
| Estadísticas | "Escuchaste X bandas" |

---

# TRAMO 3: Visual & Metadata (3-4 semanas)

## Fase 3.1 — Spotify Integration

**Objetivo**: Traer portadas y imágenes bonitas.

### Qué necesitas

- Conexión con **Spotify Web API**
- Matching: artista/álbum nuestros → IDs Spotify
- Guardar URLs de portadas

### Tareas

| Tarea | Descripción |
|-------|-------------|
| Obtener credenciales Spotify | Client ID + Secret |
| Crear servicio de búsqueda Spotify | Search artists/albums |
| Implementar matching | Nuestro artista → Spotify ID |
| Guardar URLs de portadas | En tablas artists/albums |
| Mostrar portadas en UI | Actualizar componentes |
| Agregar atribución Spotify | Obligatorio legalmente |

---

## Fase 3.2 — Enriquecimiento de Datos

- Bio más detalladas
- Genres de Spotify
- Links externos (Wikipedia, etc)
- Preview de canciones (Spotify)

---

# TRAMO 4: Letras (2-3 semanas) — MAS DELICADO

## ⚠️ Aclaración importante

**NO recomiendo mostrar letras completas en MVP.**

Razones:
- Derechos de autor complejos
- APIs sin licencia confiable
- Riesgo legal

### Opciones para MVP

#### Opción A: No mostrar letras (RECOMENDADA)
- Enlazar a Genius, AZLyrics, etc
- Botón "Ver letra en [proveedor]"
- Cero fricción legal

#### Opción B: Mostrar fragmento + enlace
- Primeros 50 palabras
- Enlace a proveedor completo
- Menor riesgo legal

#### Opción C: Integrar Musixmatch (futuro)
- API orientada a apps legales
- Requiere acuerdo comercial
- Para producto serio/monetizado

### Tareas (solo si haces B o C)

| Tarea | Descripción |
|-------|-------------|
| Investigar proveedor licenciado | Musixmatch o similar |
| Crear tabla de letras | Con metadata de licencia |
| Integrar API de letras | Fetching seguro |
| Mostrar con atribución | Creditar a proveedor |
| Manejar casos sin letra | Fallback graceful |

---

# 📊 Tabla Resumen por Fase

| Tramo | Fase | Objetivo | Duración | Output |
|-------|------|----------|----------|--------|
| **1** | 1.1 | Setup | 9h | Proyecto listo |
| **1** | 1.2 | DB | 6h | Tablas creadas |
| **1** | 1.3 | Catálogo | 8h | Puedes buscar bandas |
| **1** | 1.4 | Pantallas | 16h | UI navegable |
| **1** | 1.5 | Auth | 6h | Login/signup |
| **1** | 1.6 | Reviews | 12h | **MVP Social** |
| **1** | 1.7 | Actividad | 6h | **Producto Usable** |
| **2** | 2.1 | Listas | 10h | Curación de usuario |
| **2** | 2.2 | Follow | 6h | Comunidad |
| **2** | 2.3 | Social+ | 8h | Engagement |
| **3** | 3.1 | Spotify | 8h | Portadas/imágenes |
| **3** | 3.2 | Metadata | 6h | Datos ricos |
| **4** | 4.1 | Letras | 6-10h | (Opcional) |

**Total Tramo 1 (MVP)**: ~59 horas
**Total Tramo 1+2**: ~97 horas
**Total Tramo 1+2+3**: ~117 horas

---

# 🚀 Cómo usar este roadmap

## En Google Sheets

Crea un sheet con columnas:
```
| Tramo | Fase | Tarea | Estado | Responsable | Fecha Inicio | Fecha Fin | Notas |
```

## Reglas de ejecución

1. **Nunca más de 1 fase activa** al mismo tiempo
2. **Dentro de cada fase, 1-2 tareas por día máximo**
3. Cuando terminas una tarea → update el status
4. Cuando terminas una fase → revisás e iteras

## Recomendación de orden

```
Semana 1-2:   Tramo 1.1 + 1.2
Semana 3-4:   Tramo 1.3 + 1.4
Semana 5-6:   Tramo 1.5 + 1.6
Semana 7:     Tramo 1.7
        ↓ YA TENES MVP
Semana 8-10:  Tramo 2
Semana 11-12: Tramo 3
```

---

# 💡 Decisiones Clave Tomadas

### 1. No mostrar letras en MVP
- Riesgo legal bajo
- Se agrega después
- Usuarios no lo esperan en v1

### 2. MusicBrainz + Spotify
- MusicBrainz = catálogo completo
- Spotify = imágenes + metadata bonita
- Stack comprobado

### 3. Supabase + React
- Full-stack sin DevOps
- Auth incluida
- Escalable después

### 4. Social-first
- Ratings, reviews, listas
- Feed de actividad
- Esto es lo que hace que sea addictivo

---

# 🔧 Stack Técnico Final

```
Frontend
├─ React 18+
├─ React Router
├─ Tailwind CSS
├─ TanStack Query (data fetching)
├─ zustand (state)
└─ Supabase Client

Backend
├─ Node.js/Express (small service)
├─ Job scheduler (cron para ingesta)
└─ Integración MusicBrainz

Database
├─ Supabase (Postgres)
├─ RLS policies
└─ Indexación

APIs Externas
├─ MusicBrainz (libre)
├─ Spotify (freemium)
└─ Letras: DECIDIR después
```