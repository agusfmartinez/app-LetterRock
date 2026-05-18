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
CREATE INDEX idx_albums_external_mb_release_group_id ON albums(external_mb_release_group_id);

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
CREATE INDEX idx_tracks_title ON tracks(title);

-- ============================================
-- 2. TABLAS DE USUARIOS
-- ============================================

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

-- ============================================
-- 3. TABLAS SOCIALES
-- ============================================

-- Reviews (ratings + text)
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
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
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
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

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

-- Follows (usuarios siguiendo usuarios)
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_follows_user_id ON follows(user_id);
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE UNIQUE INDEX idx_follows_unique ON follows(user_id, follower_id);

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
CREATE INDEX idx_lists_is_public ON lists(is_public);

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
CREATE INDEX idx_list_items_position ON list_items(list_id, position);
CREATE UNIQUE INDEX idx_list_items_unique ON list_items(list_id, entity_type, entity_id);

-- Likes en reviews
CREATE TABLE review_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_likes_review_id ON review_likes(review_id);
CREATE INDEX idx_review_likes_user_id ON review_likes(user_id);
CREATE UNIQUE INDEX idx_review_likes_unique ON review_likes(user_id, review_id);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
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

-- ARTISTAS: Lectura pública
CREATE POLICY "Artists are public" ON artists
  FOR SELECT USING (TRUE);

-- ÁLBUMES: Lectura pública
CREATE POLICY "Albums are public" ON albums
  FOR SELECT USING (TRUE);

-- TRACKS: Lectura pública
CREATE POLICY "Tracks are public" ON tracks
  FOR SELECT USING (TRUE);

-- USUARIOS: Lectura pública
CREATE POLICY "Users are public" ON users
  FOR SELECT USING (TRUE);

-- USUARIOS: Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- REVIEWS: Lectura pública
CREATE POLICY "Reviews are public" ON reviews
  FOR SELECT USING (TRUE);

-- REVIEWS: Solo autenticados pueden crear
CREATE POLICY "Authenticated users can create reviews" ON reviews
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    auth.uid() IS NOT NULL
  );

-- REVIEWS: Usuarios solo pueden editar/borrar los propios
CREATE POLICY "Users can update own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews" ON reviews
  FOR DELETE USING (auth.uid() = user_id);

-- COMMENTS: Lectura pública
CREATE POLICY "Comments are public" ON comments
  FOR SELECT USING (TRUE);

-- COMMENTS: Solo autenticados pueden crear
CREATE POLICY "Authenticated users can create comments" ON comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    auth.uid() IS NOT NULL
  );

-- COMMENTS: Usuarios solo pueden editar/borrar los propios
CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- FAVORITES: Solo autenticados pueden crear
CREATE POLICY "Authenticated users can manage favorites" ON favorites
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    auth.uid() IS NOT NULL
  );

-- FAVORITES: Usuarios solo ven sus propios favoritos
CREATE POLICY "Users can see own favorites" ON favorites
  FOR SELECT USING (auth.uid() = user_id OR TRUE);

CREATE POLICY "Users can delete own favorites" ON favorites
  FOR DELETE USING (auth.uid() = user_id);

-- FOLLOWS: Solo autenticados
CREATE POLICY "Authenticated users can follow" ON follows
  FOR INSERT WITH CHECK (
    auth.uid() = follower_id AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can see follows" ON follows
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can unfollow" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- LISTS: Públicas si is_public=true, privadas si owner
CREATE POLICY "Public lists are visible, own lists always" ON lists
  FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);

CREATE POLICY "Users can create lists" ON lists
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update own lists" ON lists
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lists" ON lists
  FOR DELETE USING (auth.uid() = user_id);

-- LIST_ITEMS: Heredan visibilidad de list
CREATE POLICY "List items visible if list is visible" ON list_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lists l 
      WHERE l.id = list_items.list_id 
      AND (l.is_public = TRUE OR l.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can add to own lists" ON list_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists l 
      WHERE l.id = list_items.list_id 
      AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete from own lists" ON list_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM lists l 
      WHERE l.id = list_items.list_id 
      AND l.user_id = auth.uid()
    )
  );

-- REVIEW_LIKES: Lectura pública
CREATE POLICY "Review likes are public" ON review_likes
  FOR SELECT USING (TRUE);

-- REVIEW_LIKES: Solo autenticados
CREATE POLICY "Authenticated users can like reviews" ON review_likes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can unlike own likes" ON review_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 5. FUNCIONES ÚTILES
-- ============================================

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas que tienen updated_at
CREATE TRIGGER artists_updated_at BEFORE UPDATE ON artists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER albums_updated_at BEFORE UPDATE ON albums
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tracks_updated_at BEFORE UPDATE ON tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER lists_updated_at BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. VISTAS ÚTILES
-- ============================================

-- Vista: Albums con promedio de ratings
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

-- Vista: Artists con promedio de ratings
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

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

-- Para verificar que todo se creó:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';