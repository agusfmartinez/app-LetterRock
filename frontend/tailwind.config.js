/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rock: {
          dark: '#0a0a0a',
          card: '#1a1a1a',
          border: '#2a2a2a',
          accent: '#e85d04',
          text: '#e0e0e0',
        }
      }
    },
  },
  plugins: [],
}
