# PROMPT MAESTRO PARA CLAUDE CODE
## Letterboxd de Rock Nacional — Fase 1 + 2

### ⚠️ INSTRUCCIONES DE USO
Copia TODO este contenido y pégalo en Claude Code como un mensaje único.
Claude Code ejecutará automáticamente los pasos.

---

# 🎸 PROYECTO: Letterboxd de Rock Nacional

## CONTEXTO DEL PROYECTO

**Qué es**: Una red social tipo Letterboxd (como IMDb pero para películas) enfocada en rock nacional argentino. La gente busca bandas, ve su discografía, deja opiniones/ratings en artistas/álbumes/canciones, y sigue a otros usuarios.

**Por qué es distinto**: No es un catálogo + es una red social donde el contenido es música.

**MVP**: Búsqueda de bandas → Ver perfil artista → Ver álbumes → Dejar opiniones → Ver comunidad

**Stack decidido**:
- Frontend: React 18 + Vite + Tailwind + TanStack Query
- Backend: Express.js (pequeño, solo para ingesta de catálogo)
- Base de datos: Supabase (Postgres + Auth + Storage)
- APIs externas: MusicBrainz (catálogo), Spotify (portadas/imágenes - futuro)
- Deploy: Vercel (frontend), Railway/Render (backend)

---

## FASES A EJECUTAR AHORA

### FASE 1: Setup Base + Modelo de Datos (6-8 semanas de roadmap, pero tech = 2-3 días)
- [x] Crear estructura de proyecto (repo + carpetas)
- [x] Configurar React + Vite + Tailwind
- [x] Crear tablas en Supabase (via SQL)
- [x] Setup de rutas (React Router)
- [x] Crear componentes base reutilizables

### FASE 2: Ingesta de Catálogo + Búsqueda (1-2 semanas)
- [x] Backend: Integración con MusicBrainz API
- [x] Backend: Servicio de ingesta (buscar artista → guardar en DB)
- [x] Frontend: Página de Search
- [x] Frontend: Conectar search con backend
- [x] Mostrar resultados en tiempo real

---

## MODELO DE DATOS (IMPORTANTE)

Aquí están TODAS las tablas que necesitas. Ejecuta este SQL en Supabase:

```sql
-- ============================================
-- LETTERBOXD DE ROCK NACIONAL
-- Script SQL para Supabase
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. TABLAS DE CATÁLOGO
-- ============================================

-- Artists
CREATE TABLE artists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_mb_id VARCHAR(255) UNIQUE,
  external_spotify_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  country VARCHAR(2),
  bio TEXT,
  image_url TEXT,
  formed_year INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_artists_slug ON artists(slug);
CREATE INDEX idx_artists_name ON artists(name);
CREATE INDEX idx_artists_external_mb_id ON artists(external_mb_id);

-- Albums
CREATE TABLE albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  external_mb_release_group_id VARCHAR(255),
  external_spotify_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  release_date DATE,
  cover_url TEXT,
  album_type VARCHAR(50) DEFAULT 'studio',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_albums_artist_id ON albums(artist_id);
CREATE INDEX idx_albums_slug ON albums(slug);
CREATE INDEX idx_albums_release_date ON albums(release_date DESC);

-- Tracks
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  external_mb_recording_id VARCHAR(255),
  external_spotify_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  duration_ms INTEGER,
  track_number INTEGER,
  disc_number INTEGER DEFAULT 1,
  lyrics_status VARCHAR(50) DEFAULT 'none',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tracks_album_id ON tracks(album_id);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);

-- Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('artist', 'album', 'track')),
  entity_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_entity ON reviews(entity_type, entity_id);
CREATE UNIQUE INDEX idx_reviews_unique_per_user_entity ON reviews(user_id, entity_type, entity_id);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('artist', 'album', 'track')),
  entity_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);

-- Favorites
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('artist', 'album', 'track')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_entity ON favorites(entity_type, entity_id);
CREATE UNIQUE INDEX idx_favorites_unique ON favorites(user_id, entity_type, entity_id);

-- Follows
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_follows_user_id ON follows(user_id);
CREATE INDEX idx_follows_follower_id ON follows(follower_id);

-- Lists
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lists_user_id ON lists(user_id);

-- List Items
CREATE TABLE list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('artist', 'album', 'track')),
  entity_id UUID NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_list_items_list_id ON list_items(list_id);

-- Review Likes
CREATE TABLE review_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_likes_review_id ON review_likes(review_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;

-- Artists: Public read
CREATE POLICY "Artists are public" ON artists FOR SELECT USING (TRUE);

-- Albums: Public read
CREATE POLICY "Albums are public" ON albums FOR SELECT USING (TRUE);

-- Tracks: Public read
CREATE POLICY "Tracks are public" ON tracks FOR SELECT USING (TRUE);

-- Users: Public read
CREATE POLICY "Users are public" ON users FOR SELECT USING (TRUE);

-- Users: Can update own
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Reviews: Public read
CREATE POLICY "Reviews are public" ON reviews FOR SELECT USING (TRUE);

-- Reviews: Authenticated can create
CREATE POLICY "Authenticated can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- Reviews: Can edit own
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reviews: Can delete own
CREATE POLICY "Users can delete own reviews" ON reviews FOR DELETE USING (auth.uid() = user_id);

-- Comments: Public read
CREATE POLICY "Comments are public" ON comments FOR SELECT USING (TRUE);

-- Comments: Authenticated can create
CREATE POLICY "Authenticated can create comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- Comments: Can edit own
CREATE POLICY "Users can update own comments" ON comments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Comments: Can delete own
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Favorites: Authenticated
CREATE POLICY "Authenticated can manage favorites" ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can see own favorites" ON favorites FOR SELECT USING (auth.uid() = user_id OR TRUE);
CREATE POLICY "Users can delete own favorites" ON favorites FOR DELETE USING (auth.uid() = user_id);

-- Follows: Authenticated
CREATE POLICY "Authenticated can follow" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id AND auth.uid() IS NOT NULL);
CREATE POLICY "Follows public" ON follows FOR SELECT USING (TRUE);
CREATE POLICY "Can unfollow" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- Lists: Public if public, own always
CREATE POLICY "Lists visibility" ON lists FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);
CREATE POLICY "Authenticated can create lists" ON lists FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);
CREATE POLICY "Can update own lists" ON lists FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Can delete own lists" ON lists FOR DELETE USING (auth.uid() = user_id);

-- List Items: Inherit from list
CREATE POLICY "List items visibility" ON list_items FOR SELECT USING (EXISTS (SELECT 1 FROM lists l WHERE l.id = list_items.list_id AND (l.is_public = TRUE OR l.user_id = auth.uid())));
CREATE POLICY "Can add to own lists" ON list_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM lists l WHERE l.id = list_items.list_id AND l.user_id = auth.uid()));
CREATE POLICY "Can delete from own lists" ON list_items FOR DELETE USING (EXISTS (SELECT 1 FROM lists l WHERE l.id = list_items.list_id AND l.user_id = auth.uid()));

-- Review Likes: Public read
CREATE POLICY "Review likes public" ON review_likes FOR SELECT USING (TRUE);
CREATE POLICY "Authenticated can like" ON review_likes FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);
CREATE POLICY "Can unlike own" ON review_likes FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- VISTAS ÚTILES
-- ============================================

CREATE VIEW albums_with_stats AS
SELECT 
  a.id,
  a.title,
  a.artist_id,
  a.cover_url,
  COUNT(DISTINCT r.id) as review_count,
  AVG(r.rating::numeric) as avg_rating,
  a.release_date
FROM albums a
LEFT JOIN reviews r ON r.entity_type = 'album' AND r.entity_id = a.id
GROUP BY a.id, a.title, a.artist_id, a.cover_url, a.release_date;

CREATE VIEW artists_with_stats AS
SELECT 
  ar.id,
  ar.name,
  ar.slug,
  ar.image_url,
  COUNT(DISTINCT r.id) as review_count,
  AVG(r.rating::numeric) as avg_rating
FROM artists ar
LEFT JOIN reviews r ON r.entity_type = 'artist' AND r.entity_id = ar.id
GROUP BY ar.id, ar.name, ar.slug, ar.image_url;
```

**IMPORTANTE**: Antes de ejecutar esto en Supabase, debes:
1. Ir a [supabase.com](https://supabase.com)
2. Crear un nuevo proyecto
3. Ir a SQL Editor
4. Pegar TODO el script
5. Ejecutar

Luego, copia estos datos:
- `SUPABASE_URL` (en Settings → API)
- `SUPABASE_ANON_KEY` (en Settings → API)

---

## ESTRUCTURA QUE QUIERO QUE CREES

```
rock-nacional-app/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Navbar.jsx
│   │   │   │   ├── Footer.jsx
│   │   │   │   ├── ArtistCard.jsx
│   │   │   │   ├── AlbumCard.jsx
│   │   │   │   ├── TrackRow.jsx
│   │   │   │   ├── RatingStars.jsx
│   │   │   │   ├── ReviewCard.jsx
│   │   │   │   └── CommentThread.jsx
│   │   │   └── forms/
│   │   │       ├── ReviewForm.jsx
│   │   │       ├── CommentForm.jsx
│   │   │       └── LoginForm.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Search.jsx
│   │   │   ├── ArtistDetail.jsx
│   │   │   ├── AlbumDetail.jsx
│   │   │   ├── TrackDetail.jsx
│   │   │   ├── Profile.jsx
│   │   │   └── AuthPages.jsx
│   │   ├── services/
│   │   │   ├── supabaseClient.ts
│   │   │   ├── api.ts
│   │   │   └── search.ts
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useArtist.ts
│   │   │   └── useReviews.ts
│   │   ├── store/
│   │   │   ├── authStore.ts
│   │   │   └── uiStore.ts
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── musicbrainz.js
│   │   │   └── supabaseService.js
│   │   ├── routes/
│   │   │   ├── search.js
│   │   │   └── artists.js
│   │   ├── middleware/
│   │   │   ├── errorHandler.js
│   │   │   └── rateLimit.js
│   │   └── index.js
│   ├── .env.example
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## TAREAS ESPECÍFICAS QUE QUIERO QUE HAGAS

### 1. SETUP INICIAL
```
[ ] Crear estructura de carpetas frontend + backend
[ ] Crear package.json para frontend (React 18 + Vite + Tailwind + depencias)
[ ] Crear package.json para backend (Express + axios + dotenv)
[ ] Crear vite.config.js
[ ] Crear tailwind.config.js
[ ] Crear .gitignore
[ ] Crear README.md básico
```

### 2. FRONTEND - COMPONENTES BASE
```
[ ] Crear Navbar.jsx (logo, search input básico, menu)
[ ] Crear Footer.jsx
[ ] Crear ArtistCard.jsx (muestra nombre + foto básica)
[ ] Crear AlbumCard.jsx (portada + título + año)
[ ] Crear TrackRow.jsx (número + título + duración)
[ ] Crear RatingStars.jsx (selector 1-5 estrellas)
[ ] Crear ReviewCard.jsx (muestra review + autor + fecha)
[ ] Crear CommentThread.jsx (lista de comentarios)
```

### 3. FRONTEND - PÁGINAS BASE
```
[ ] Crear Home.jsx (layout básico, hero)
[ ] Crear Search.jsx (input + lista de resultados)
[ ] Crear ArtistDetail.jsx (info artista + discografía)
[ ] Crear AlbumDetail.jsx (portada + tracklist + reviews)
[ ] Crear TrackDetail.jsx (info track + comentarios)
[ ] Crear Profile.jsx (datos usuario, favoritos)
[ ] Crear AuthPages.jsx (login/signup mockado)
```

### 4. FRONTEND - ROUTING
```
[ ] Configurar React Router
[ ] Crear rutas:
    / → Home
    /search?q=query → Search results
    /artist/:slug → Artist detail
    /album/:id → Album detail
    /track/:id → Track detail
    /user/:username → Profile
    /auth/login → Login
    /auth/signup → Signup
```

### 5. FRONTEND - SERVICIOS
```
[ ] Crear supabaseClient.ts (cliente Supabase inicializado)
[ ] Crear api.ts (funciones para llamar al backend)
[ ] Crear search.ts (búsqueda de artistas)
```

### 6. FRONTEND - HOOKS
```
[ ] Crear useAuth.ts (manejo de autenticación)
[ ] Crear useArtist.ts (traer datos de artista)
[ ] Crear useReviews.ts (crear/editar/borrar reviews)
```

### 7. FRONTEND - STATE (Zustand)
```
[ ] Crear authStore.ts (user, login, logout)
[ ] Crear uiStore.ts (searchQuery, filters)
```

### 8. BACKEND - SERVICIOS
```
[ ] Crear musicbrainz.js (integración con API)
    - searchArtist(query)
    - getArtistAlbums(artistId)
    - getAlbumTracks(albumId)
    - Manejar rate limits (1 req/seg)
[ ] Crear supabaseService.js (conectar con Supabase)
    - saveArtist()
    - saveAlbum()
    - saveTracks()
    - searchInDatabase()
```

### 9. BACKEND - RUTAS
```
[ ] Crear /api/search?q=query
    - Busca en DB primero
    - Si no está → consulta MusicBrainz
    - Guarda en DB
    - Retorna JSON
[ ] Crear /api/artists/:id
    - Devuelve artista + discografía + stats
[ ] Crear /api/albums/:id
    - Devuelve álbum + tracks
```

### 10. BACKEND - MIDDLEWARE
```
[ ] Crear errorHandler.js (manejo de errores global)
[ ] Crear rateLimit.js (rate limiting)
```

### 11. CONECTAR FRONTEND + BACKEND
```
[ ] En Search.jsx: usar API endpoint /api/search
[ ] En ArtistDetail.jsx: usar API endpoint /api/artists/:id
[ ] En AlbumDetail.jsx: usar API endpoint /api/albums/:id
```

### 12. ARCHIVOS CONFIG
```
[ ] Crear .env.example (backend)
[ ] Crear .env.local para development (con tus credenciales Supabase)
[ ] Crear README.md con instrucciones de setup
```

---

## VARIABLES DE ENTORNO

### Backend (.env)
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=xxxxx
MUSICBRAINZ_USER_AGENT=RockNacionalApp/1.0 (contact@example.com)
NODE_ENV=development
PORT=3000
```

### Frontend (.env.local)
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_KEY=xxxxx
VITE_API_URL=http://localhost:3000
```

---

## LIBRERÍAS QUE NECESITAS

### Frontend (package.json)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.25.0",
    "zustand": "^4.4.0",
    "@supabase/supabase-js": "^2.38.0",
    "axios": "^1.6.0",
    "slugify": "^1.6.6"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

### Backend (package.json)
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "dotenv": "^16.3.0",
    "axios": "^1.6.0",
    "@supabase/supabase-js": "^2.38.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

---

## IMPORTANTE - INSTRUCCIONES FINALES

1. **Crea TODO el código desde cero** (no uses scaffolders como create-react-app)
2. **Sigue EXACTAMENTE la estructura de carpetas que puse arriba**
3. **No hagas microoptimizaciones** - prioriza que funcione
4. **Cada componente debe tener comentarios** explicando qué hace
5. **Los servicios deben manejar errores gracefully**
6. **Las vistas deben ser responsive (Tailwind)**
7. **No necesitas tests por ahora** - enfócate en que funcione
8. **Cuando termines cada tarea, confirma que funciona** (si es frontend, visualmente; si es backend, con console.log)

---

## ORDEN DE EJECUCIÓN RECOMENDADO

**Día 1:**
1. Setup inicial (carpetas + package.json)
2. Frontend: Componentes base (Navbar, Footer, Cards)

**Día 2:**
3. Frontend: Páginas base (Home, Search, Detail pages)
4. Frontend: Routing completo

**Día 3:**
5. Frontend: Servicios y hooks
6. Frontend: Zustand stores

**Día 4:**
7. Backend: Setup Express + MusicBrainz service
8. Backend: Rutas de search y artistas

**Día 5:**
9. Conectar frontend + backend
10. Testing manual en navegador

---

## VALIDACIÓN FINAL

Cuando termines, debería poder:

```
✅ npm run dev (frontend) → app abre en http://localhost:5173
✅ npm run dev (backend) → server corre en http://localhost:3000
✅ Escribir "Soda Stereo" en search → devuelve resultados (desde DB o MusicBrainz)
✅ Hacer click en artista → muestra detalles + discografía
✅ Ver álbumes + tracks de ese artista
✅ Navbar y Footer funciona en todas las páginas
✅ Responsive en mobile
```

---