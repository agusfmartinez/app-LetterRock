import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Explícito y no el `localhost` por defecto: acá `localhost` resuelve a ::1
    // y el servidor termina escuchando sólo en IPv6, con lo que
    // http://127.0.0.1:5173 da conexión rechazada.
    //
    // Y por 127.0.0.1 hay que entrar sí o sí: es la única forma de loopback que
    // Spotify acepta como dirección de vuelta del permiso para crear playlists
    // —`localhost` no se puede registrar—.
    //
    // Efecto colateral: en esta máquina http://localhost:5173 deja de abrir.
    // Es a propósito. Un solo origen en desarrollo también evita la confusión
    // de tener la sesión iniciada en una dirección y no en la otra.
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
