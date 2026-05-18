import { Routes, Route } from 'react-router-dom'
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
import { useAuth } from './hooks/useAuth'

export default function App() {
  useAuth()

  return (
    <div className="min-h-screen flex flex-col bg-rock-dark text-rock-text">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/artist/:slug" element={<ArtistDetail />} />
          <Route path="/album/:id" element={<AlbumDetail />} />
          <Route path="/track/:id" element={<TrackDetail />} />
          <Route path="/user/:username" element={<Profile />} />
          <Route path="/auth/login" element={<AuthPages mode="login" />} />
          <Route path="/auth/signup" element={<AuthPages mode="signup" />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
