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

## Estado actual (2026-05-18)
Fases 1.1 + 1.3 + 1.4 completadas. App funcional: búsqueda → artista → discografía.

Archivos clave:
- `frontend/src/` — componentes, páginas, services, hooks, stores
- `backend/src/` — routes, services, middleware
- `.gitignore`, `README.md`

Búsqueda: botón submit (no debounce). Solo guarda artista en DB al entrar al detalle, no al buscar.
Filtros MB: post-filter por country (AR/UY) + área conocida + género (bloquea trap/reggaeton/etc).
"Próximamente..." si hay resultados AR/UY pero todos bloqueados por género.

**Pendiente del usuario:**
1. Ejecutar `supabaseschema.sql` en Supabase (si no lo hizo)
2. `.env.local` en frontend y `.env` en backend con credenciales reales
3. `npm install` en ambos directorios

**Próximas fases:**
- Fase 1.5: Auth flow completo con Supabase
- Fase 1.6: Reviews/Comments conectados
- Fase 1.7: Favoritos + feed de actividad

## Deploy (pendiente)
- **Estructura**: monorepo — un repo git en raíz con `frontend/` y `backend/`
- **Vercel** (frontend): Root Directory = `frontend`, Build = `npm run build`, Output = `dist`
- **Render** (backend): Root Directory = `backend`, Start = `npm start`
