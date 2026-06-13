---
name: LetterRock project context
description: Estado del proyecto LetterRock — Letterboxd de Rock Nacional Argentino
type: project
---

Red social tipo Letterboxd para rock nacional argentino.

**Why:** MVP social — búsqueda de bandas + ratings + reviews + comunidad.

**How to apply:** El proyecto ya tiene estructura completa generada. Próximos pasos son instalar deps y conectar Supabase.

## Stack
- Frontend: React 18 + Vite + Tailwind + TanStack Query + Zustand — `frontend/`
- Backend: Express.js (ingesta MusicBrainz) — `backend/`
- DB: Supabase (Postgres + Auth) — schema en `supabaseschema.sql` (el usuario lo ejecuta manualmente)
- APIs: MusicBrainz (catálogo), Spotify (futuro, Tramo 3)

## Estado actual (2026-05-19)

### Completado
- **Fase 1.1** — estructura monorepo, configs, .gitignore, README
- **Fase 1.3** — ingesta MusicBrainz: búsqueda → guarda artista al entrar al detalle (no al buscar)
- **Fase 1.4** — UI base: todas las páginas y componentes
- **Fase 1.5** — Auth con Supabase: signup/login/logout funcional ✓

### Decisiones tomadas
- Búsqueda: botón submit, no debounce
- Guardar artista en DB solo al entrar al detalle del artista, no en resultados de búsqueda
- Filtros MusicBrainz: post-filter por country (AR/UY) + lista de áreas conocidas + géneros bloqueados (trap/reggaeton/hip-hop/etc)
- "Próximamente..." si hay resultados AR/UY pero todos bloqueados por género
- Email confirmation deshabilitado en Supabase (MVP)
- Monorepo: un repo git en raíz, `frontend/` y `backend/` como subcarpetas
- Memoria del proyecto en `.claude/memory/` dentro del repo

### Ajustes realizados
- `users` table requería política RLS de INSERT (faltaba en el schema original) → ejecutar: `CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);`
- `authStore.signup()` ahora muestra error si el INSERT al perfil falla
- `ArtistCard` navega con `external_mb_id` para artistas no guardados, `slug` para guardados
- Búsqueda no guarda artistas, solo devuelve datos crudos de MB

### Completado (cont.)
- **Fase 1.6** — Reviews con rating en artistas/álbumes ✓

### Ajustes fase 1.6
- `albums` table necesitaba UNIQUE constraint: `ALTER TABLE albums ADD CONSTRAINT albums_mb_release_group_id_unique UNIQUE (external_mb_release_group_id);`
- Ingesta de álbumes ahora es fire-and-forget (no bloquea respuesta). Frontend hace auto-poll cada 3 seg hasta que aparecen.
- `ingestingNow` Set previene ingestas concurrentes del mismo artista.
- `ingestFailed` Set previene reintentos infinitos si la ingesta falla.

### Fase 1.6.5 — Spotify para álbumes ✓ (2026-06-12)
- **MB sigue siendo la fuente para búsqueda de artistas** (filtro país AR/UY + género)
- **Spotify reemplaza MB para ingesta de álbumes** — data oficial, sin bootlegs, portadas incluidas
- Nuevo `backend/src/services/spotifyService.js`: Client Credentials auth con token cacheado, `searchArtist`, `getArtistAlbums` con paginación
- `albums` table: columnas nuevas `spotify_id TEXT`, `cover_url TEXT`
- `albums` upsert usa `onConflict: 'spotify_id'` (requiere UNIQUE constraint)
- `artists` table: columna `external_spotify_id` ya existía en el schema original
- `album_type` ahora usa valores de Spotify: `'album'` | `'single'` | `'compilation'`
- Frontend `ArtistDetail`: tabs "Álbumes" / "Sencillos y EP" — filtra por `album_type`
- `AlbumCard` ya tenía soporte para `cover_url`
- Logs: `[Spotify]` prefix para llamadas a Spotify API, `[DB]` para Supabase
- Límite Spotify `/artists/{id}/albums`: **máximo 10** (no 50 ni 20)

### SQL ejecutado en Supabase (acumulado)
```sql
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
ALTER TABLE albums ADD CONSTRAINT albums_mb_release_group_id_unique UNIQUE (external_mb_release_group_id);
ALTER TABLE albums ADD COLUMN spotify_id TEXT;
ALTER TABLE albums ADD COLUMN cover_url TEXT;
ALTER TABLE albums ADD CONSTRAINT albums_spotify_id_unique UNIQUE (spotify_id);
```

### Próximas fases
- Fase 1.7: Favoritos + feed de actividad

## Deploy (pendiente)
- **Estructura**: monorepo — un repo git en raíz con `frontend/` y `backend/`
- **Vercel** (frontend): Root Directory = `frontend`, Build = `npm run build`, Output = `dist`
- **Render** (backend): Root Directory = `backend`, Start = `npm start`
