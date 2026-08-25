import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/common/Navbar'
import Footer from './components/common/Footer'
import Home from './pages/Home'
import Search from './pages/Search'
import ArtistDetail from './pages/ArtistDetail'
import AlbumDetail from './pages/AlbumDetail'
import TrackDetail from './pages/TrackDetail'
import Profile from './pages/Profile'
import AuthPages from './pages/AuthPages'
import AdminUsers from './pages/AdminUsers'
import CollectionDetail from './pages/CollectionDetail'
import CollectionSection from './pages/CollectionSection'
import AdminCollections from './pages/AdminCollections'
import AdminCollectionEdit from './pages/AdminCollectionEdit'
import AdminSectionEdit from './pages/AdminSectionEdit'
import AdminArtists from './pages/AdminArtists'
import AdminArtistEdit from './pages/AdminArtistEdit'
import AdminAlbumEdit from './pages/AdminAlbumEdit'
import { useAuth } from './hooks/useAuth'

/** Cada navegación arranca arriba: si no, saltar de década conserva el scroll. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  useAuth()

  return (
    <div className="min-h-screen flex flex-col bg-rock-dark text-rock-text">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/artist/:slug" element={<ArtistDetail />} />
          <Route path="/album/:id" element={<AlbumDetail />} />
          <Route path="/track/:id" element={<TrackDetail />} />
          <Route path="/coleccion/:slug" element={<CollectionDetail />} />
          <Route path="/coleccion/:slug/:sectionSlug" element={<CollectionSection />} />
          <Route path="/user/:username" element={<Profile />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/colecciones" element={<AdminCollections />} />
          <Route path="/admin/coleccion/:slug" element={<AdminCollectionEdit />} />
          <Route path="/admin/coleccion/:slug/:sectionSlug" element={<AdminSectionEdit />} />
          <Route path="/admin/catalogo" element={<AdminArtists />} />
          <Route path="/admin/catalogo/ocultos" element={<AdminArtists hidden />} />
          <Route path="/admin/artista/:id" element={<AdminArtistEdit />} />
          <Route path="/admin/album/:id" element={<AdminAlbumEdit />} />
          <Route path="/auth/login" element={<AuthPages mode="login" />} />
          <Route path="/auth/signup" element={<AuthPages mode="signup" />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
