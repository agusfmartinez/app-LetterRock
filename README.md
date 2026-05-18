# 🎸 LetterRock — Letterboxd de Rock Nacional Argentino

Red social para descubrir, opinar y compartir rock nacional argentino.

## Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + TanStack Query + Zustand
- **Backend**: Express.js (ingesta de catálogo)
- **Base de datos**: Supabase (Postgres + Auth)
- **APIs**: MusicBrainz (catálogo), Spotify (portadas, futuro)

## Setup

### 1. Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a SQL Editor → ejecutar `supabaseschema.sql`
3. Copiar `SUPABASE_URL` y `SUPABASE_ANON_KEY` desde Settings → API

### 2. Backend

```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# Editar .env.local con tus credenciales
npm install
npm run dev
```

## Uso

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Buscar "Soda Stereo" → ingesta automática desde MusicBrainz → ver discografía
