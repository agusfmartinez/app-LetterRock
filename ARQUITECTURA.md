# 🏗️ Arquitectura de la App — Letterboxd Rock Nacional

## 1. Estructura de Carpetas (Frontend + Backend)

```
rock-nacional-app/
├── frontend/                    # React App
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # Reutilizables
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
│   │   │   ├── AuthPages.jsx
│   │   │   └── ListDetail.jsx
│   │   ├── services/
│   │   │   ├── supabase.ts      # Cliente Supabase
│   │   │   ├── api.ts           # Llamadas al backend
│   │   │   ├── search.ts        # Búsqueda
│   │   │   └── musicbrainz.ts   # (Opcional) directo si no hay backend
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useArtist.ts
│   │   │   ├── useReviews.ts
│   │   │   └── useFavorites.ts
│   │   ├── store/               # Zustand
│   │   │   ├── authStore.ts
│   │   │   └── uiStore.ts
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
├── backend/                     # Node.js Express
│   ├── src/
│   │   ├── services/
│   │   │   ├── musicbrainz.js  # MusicBrainz API
│   │   │   ├── spotify.js      # Spotify API (futuro)
│   │   │   └── ingestion.js    # Guardar en DB
│   │   ├── routes/
│   │   │   ├── search.js       # /api/search
│   │   │   ├── artists.js      # /api/artists
│   │   │   ├── albums.js       # /api/albums
│   │   │   └── tracks.js       # /api/tracks
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── rateLimit.js
│   │   ├── jobs/
│   │   │   └── syncCatalog.js  # Cron jobs para actualizar catálogo
│   │   └── index.js            # Entry point
│   ├── package.json
│   └── .env.example
│
└── README.md
```

---

## 2. Flujo de Datos — Caso: Buscar una Banda

### Usuario escribe "Soda Stereo" en el buscador

```
┌─────────────────┐
│  Frontend React │
│                 │
│  Input: buscar  │ ─────── onChange → debounce(300ms)
└─────────────────┘                      ↓
                        ┌──────────────────────────┐
                        │  Backend Express         │
                        │  GET /api/search?q=soda  │
                        └──────────────────────────┘
                                      ↓
                        ┌──────────────────────────┐
                        │ Consultar Supabase       │
                        │ SELECT * FROM artists    │
                        │ WHERE name ILIKE %soda%  │
                        └──────────────────────────┘
                                      ↓
                        ¿Encontró en DB?
                           ↙              ↘
                          SÍ               NO
                           ↓                ↓
                    Retorna datos    Consulta MusicBrainz
                    de DB            GET /ws/2/artist/?query=soda
                                             ↓
                                      ┌─────────────────┐
                                      │ MusicBrainz API │
                                      └─────────────────┘
                                             ↓
                                      Guarda en Supabase
                                      INSERT INTO artists
                                             ↓
                                      Retorna datos
                           ↓─────────────────↓
                           │                 │
                     ┌──────────────────────────────┐
                     │ Backend devuelve JSON        │
                     │ [{ id, name, slug, ... }]    │
                     └──────────────────────────────┘
                                      ↓
                     ┌──────────────────────────────┐
                     │ Frontend React renderiza     │
                     │ Lista de resultados          │
                     └──────────────────────────────┘
```

---

## 3. Rutas del Frontend (React Router)

```
/                              → Home (trending, latest reviews)
/search?q=query                → Search results
/artist/:slug                  → Artist detail
/artist/:slug/albums           → Artist's albums
/album/:id                     → Album detail + reviews
/track/:id                     → Track detail + comments
/user/:username                → User profile
/user/:username/favorites      → User's favorite artists/albums
/user/:username/lists          → User's lists
/list/:id                      → List detail
/auth/login                    → Login
/auth/signup                   → Signup
/profile                       → Own profile (protegida)
```

---

## 4. Endpoints del Backend

### Search
```
GET /api/search?q=query&limit=20
→ Busca en artists, albums, tracks
→ Retorna: { artists: [], albums: [], tracks: [] }
```

### Artists
```
GET /api/artists/:id                   → Detalles artista
GET /api/artists/:id/albums            → Discografía
GET /api/artists/:id/reviews           → Reviews del artista
GET /api/artists/:id/stats             → Promedio ratings, counts
POST /api/artists/sync                 → Sincronizar desde MusicBrainz (admin)
```

### Albums
```
GET /api/albums/:id                    → Detalles álbum
GET /api/albums/:id/tracks             → Canciones
GET /api/albums/:id/reviews            → Reviews del álbum
```

### Tracks
```
GET /api/tracks/:id                    → Detalles canción
GET /api/tracks/:id/comments           → Comentarios
```

### Users (vía Supabase, no backend)
```
POST /auth/signup                      → Crear usuario
POST /auth/login                       → Login
POST /auth/logout                      → Logout
GET /api/users/:username               → Perfil público
PUT /api/users/me                      → Actualizar propio perfil
```

### Reviews (vía Supabase)
```
POST /api/reviews                      → Crear review
PUT /api/reviews/:id                   → Editar review
DELETE /api/reviews/:id                → Borrar review
GET /api/reviews?entity_type=album&entity_id=xxx → Reviews de un álbum
```

### Comments (vía Supabase)
```
POST /api/comments                     → Crear comentario
PUT /api/comments/:id                  → Editar
DELETE /api/comments/:id               → Borrar
GET /api/comments?entity_type=album... → Comentarios
```

### Favorites (vía Supabase)
```
POST /api/favorites                    → Agregar favorito
DELETE /api/favorites/:id              → Quitar favorito
GET /api/favorites?user_id=xxx         → Mis favoritos
```

---

## 5. Componentes y sus Props

### ArtistCard
```jsx
<ArtistCard 
  artist={{ id, name, image_url, slug }}
  onSelect={(artist) => navigate(`/artist/${artist.slug}`)}
/>
```

### AlbumCard
```jsx
<AlbumCard
  album={{ id, title, cover_url, release_date }}
  rating={4.2}
  reviewCount={15}
  onClick={() => navigate(`/album/${album.id}`)}
/>
```

### RatingStars
```jsx
<RatingStars
  value={4}
  max={5}
  onRate={(rating) => submitReview(rating)}
  interactive={true}
/>
```

### ReviewCard
```jsx
<ReviewCard
  review={{
    id,
    user: { username, avatar_url },
    rating,
    text,
    created_at,
    likeCount
  }}
  onEdit={() => setEditing(true)}
  onDelete={() => deleteReview()}
  onLike={() => likeReview()}
/>
```

---

## 6. Flujo de Autenticación

```
┌─────────────────┐
│   Usuario       │
│   abre app      │
└─────────────────┘
        ↓
┌─────────────────────────────┐
│ Supabase verifica session   │
│ (localStorage token)        │
└─────────────────────────────┘
        ↓
    ¿Token válido?
        ↙    ↘
       SÍ      NO
        ↓       ↓
   Logueado  Ir a login
   (render
    pages)
        ↓
    (usuario hace click
     en "Reviews")
        ↓
  Supabase client
  supabase.auth.getSession()
        ↓
  Si sesión activa:
  → Permite escribir review
  Si no:
  → Redirige a login
```

---

## 7. Flujo de Creación de Review

```
Usuario ve álbum "Siempre Es Hoy"
    ↓
Click en "Rating"
    ↓
┌─────────────────────────────┐
│ ReviewForm                  │
│ - Stars selector (1-5)      │
│ - Textarea                  │
│ - Submit button             │
└─────────────────────────────┘
    ↓
Valida (rating + opcional texto)
    ↓
┌─────────────────────────────┐
│ supabase                    │
│   .from('reviews')          │
│   .insert({                 │
│     user_id: user.id,       │
│     entity_type: 'album',   │
│     entity_id: album.id,    │
│     rating: 5,              │
│     text: '...'             │
│   })                        │
└─────────────────────────────┘
    ↓
¿Success?
    ↙    ↘
   SÍ     NO
    ↓      ↓
Refetch Mostrar
reviews  error
    ↓
Toast: ✅ Review publicada
```

---

## 8. Estado Global (Zustand)

```ts
// store/authStore.ts
export const useAuthStore = create((set) => ({
  user: null,
  isLoading: false,
  login: (email, password) => { ... },
  signup: (email, password) => { ... },
  logout: () => { ... },
  setUser: (user) => set({ user })
}));

// store/uiStore.ts
export const useUiStore = create((set) => ({
  searchQuery: '',
  selectedFilter: 'all',
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSelectedFilter: (f) => set({ selectedFilter: f })
}));
```

---

## 9. Custom Hooks

```ts
// hooks/useArtist.ts
export const useArtist = (slug) => {
  const [artist, setArtist] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetchArtist(slug);
    fetchAlbums(slug);
    fetchReviews('artist', artistId);
  }, [slug]);
  
  return { artist, albums, reviews, isLoading };
};

// hooks/useReviews.ts
export const useReviews = (entityType, entityId) => {
  const [reviews, setReviews] = useState([]);
  
  const createReview = async (rating, text) => { ... };
  const updateReview = async (reviewId, data) => { ... };
  const deleteReview = async (reviewId) => { ... };
  
  return { reviews, createReview, updateReview, deleteReview };
};
```

---

## 10. Variables de Entorno

### Backend (.env)
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=xxxxx
MUSICBRAINZ_USER_AGENT=MyApp/1.0 (contact@example.com)
SPOTIFY_CLIENT_ID=xxxxx
SPOTIFY_CLIENT_SECRET=xxxxx
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW_MS=1000
NODE_ENV=development
PORT=3000
```

### Frontend (.env)
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_KEY=xxxxx
VITE_API_URL=http://localhost:3000
```

---

## 11. Orden de Desarrollo Recomendado

### Semana 1: Setup + Home
- [ ] Clonar repo, instalar dependencias
- [ ] Configurar Supabase (crear proyecto, ejecutar SQL)
- [ ] Crear componentes básicos (Navbar, Footer, ArtistCard)
- [ ] Página Home mockada

### Semana 2: Search + Catálogo
- [ ] Backend: Servicio MusicBrainz + ingesta
- [ ] Frontend: Página Search
- [ ] Conectar search con backend
- [ ] Mostrar resultados

### Semana 3: Detail Pages
- [ ] Página Artist Detail
- [ ] Página Album Detail
- [ ] Página Track Detail
- [ ] Conexión con datos reales

### Semana 4: Auth + Users
- [ ] Configurar Supabase Auth
- [ ] Login / Signup
- [ ] Página Profile
- [ ] Perfil editable

### Semana 5-6: Reviews + Social
- [ ] ReviewForm + RatingStars
- [ ] Crear/editar/borrar reviews
- [ ] Comentarios
- [ ] Favoritos
- [ ] Feed básico

### Semana 7-8: Listas + Polish
- [ ] Sistema de listas
- [ ] Página de lista
- [ ] Optimizaciones
- [ ] Testing manual

---

## 12. Testing & QA

### Manual Testing Checklist
```
[ ] Login/Signup funciona
[ ] Búsqueda de artista devuelve resultados
[ ] Hacer click en artista muestra detalles
[ ] Rating de 1-5 funciona
[ ] Escribir review se guarda
[ ] Ver reviews de otros usuarios
[ ] Agregar a favoritos funciona
[ ] Crear lista funciona
[ ] Compartir lista (copiar URL)
[ ] Performance: carga < 3 seg
```

---

## 13. Deployment

### Frontend (Vercel)
```bash
npm run build
# Push a repo, Vercel auto-deploya
# URL: rock-nacional.vercel.app
```

### Backend (Railway/Render)
```bash
npm run build
# Deploy via git push
```

### Supabase
- Ya alojado en Supabase Cloud
- Backups automáticos
- SSL incluido

---

## 14. Performance & Optimizaciones (Después)

```
Frontend
├─ Code splitting (React.lazy)
├─ Image optimization
├─ Caching with TanStack Query
├─ Virtualization de listas largas
└─ Service Worker

Backend
├─ Indexación de DB
├─ Caching de queries frecuentes
├─ Rate limiting
└─ Compression (gzip)
```

---

## 15. Resumen: Tech Stack Final

```
Frontend       → React 18 + Vite + Tailwind
State          → Zustand (auth, UI)
Data Fetching  → TanStack Query + Supabase Client
Auth           → Supabase Auth
Database       → Supabase (Postgres)
Backend        → Express.js (pequeño, para ingesta)
External APIs  → MusicBrainz, Spotify (futuro)
Deploy         → Vercel (frontend), Railway/Render (backend)
```

---

**¿Listo para empezar? Próximo paso: Crear el repo en GitHub y ejecutar el script SQL en Supabase 🚀**