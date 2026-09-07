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
          // Warm off-black instead of neutral #0a0a0a — matches the rust accent
          // instead of fighting it.
          dark: '#100d0b',
          card: '#1b1613',
          border: '#332720',
          borderStrong: '#4a382c',
          text: '#efe8e1',
          // Rust/ember accent, desaturated from the old #e85d04 (96% sat, near-neon)
          // down to ~65% so it reads as considered rather than shouting.
          accent: '#c1592c',
          accentBright: '#e07a45',
          accentDim: '#7a3a1f',
        },
        // Tailwind's default `gray` is cool/blue-tinted. The app is a warm dark
        // theme (rust accent, warm-black surfaces), so every `text-gray-*` /
        // `border-gray-*` in the codebase gets retinted here — no per-file edits.
        gray: {
          300: '#c9beb4',
          400: '#a89a8d',
          500: '#8a7c70',
          600: '#6b5f55',
          700: '#4f453d',
        },
      },
      fontFamily: {
        // Condensed poster-grotesk for headlines — gig-flyer energy instead of
        // system-ui/Inter blandness.
        display: ['"Oswald"', 'sans-serif'],
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        // Shadows tinted with the accent hue instead of flat black — reads as
        // light bouncing off a warm surface, not a generic drop-shadow.
        card: '0 1px 2px rgba(16, 13, 11, 0.4), 0 8px 24px -8px rgba(16, 13, 11, 0.6)',
        'card-hover': '0 4px 10px -2px rgba(0,0,0,0.5), 0 16px 32px -12px rgba(193, 89, 44, 0.35)',
        glow: '0 0 0 1px rgba(193, 89, 44, 0.4), 0 0 24px rgba(193, 89, 44, 0.25)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
      },
      backgroundImage: {
        grain: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
