/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* La paleta oscura del sitio. Los nombres son roles, no colores: si
           algún día el marrón se vuelve otra cosa, cambia acá y nada más. */
        rock: {
          dark: '#100d0b',        // fondo de página
          card: '#1b1613',        // superficie elevada
          cardHover: '#231c17',   // la misma superficie, con el mouse encima
          border: '#332720',      // separador normal
          borderStrong: '#4a382c',// separador que tiene que verse
          text: '#efe8e1',        // texto principal
          accent: '#c1592c',      // terracota: la voz de la marca
          accentBright: '#e07a45',// hover del acento
          accentDim: '#7a3a1f',   // fondos tintados, bordes de alerta
        },
        /* Grises tibios, no neutros: sobre el marrón del fondo un gris frío se
           ve azul. Se usan para texto secundario y metadatos. */
        gray: {
          300: '#c9bcb0',
          400: '#a89a8d',
          500: '#8a7c70',
          600: '#6b5f55',
        },
      },
      fontFamily: {
        /*
         * El par de la maqueta. Caprasimo es una display redonda y pesada —
         * es la identidad del rediseño, y lo que lo separa de cualquier sitio
         * de rock con una condensada gris.
         *
         * Ojo: Caprasimo tiene UN solo peso (400). No lleva `font-bold` nunca:
         * el navegador sintetizaría una negrita falsa y se ve sucia. El peso
         * ya está en la letra.
         */
        display: ['Caprasimo', 'Georgia', 'serif'],
        body: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        /* Los títulos de pantalla escalan con el viewport: la maqueta los pide
           fluidos, no en pasos. */
        screen: ['clamp(36px, 4.8vw, 58px)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        hero: ['clamp(42px, 6vw, 74px)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        kicker: ['11px', { lineHeight: '1.2', letterSpacing: '0.15em' }],
      },
      maxWidth: {
        prose: '58ch',   // ancho de lectura del README (52–62ch)
      },
      /*
       * La escala del rediseño. Es deliberadamente generosa: lo redondeado es
       * la identidad de la maqueta, no un detalle — botones, inputs y tags van
       * en píldora, y las superficies grandes en 22–34px.
       *
       * Pisa la escala default de Tailwind a propósito, así `rounded-lg` ya
       * significa 22px en todo el sitio y no hay que tocar cada uso.
       */
      borderRadius: {
        none: '0',
        sm: '8px',
        DEFAULT: '12px',
        md: '16px',
        lg: '22px',
        xl: '28px',
        '2xl': '32px',
        '3xl': '34px',
        full: '9999px',
      },
      boxShadow: {
        /* Tintadas con el acento, no negras: una sombra gris sobre marrón
           apaga el color en vez de dar profundidad. */
        card: '0 2px 10px rgba(0,0,0,0.45)',
        'card-hover': '0 8px 26px rgba(0,0,0,0.55)',
        glow: '0 0 0 1px rgba(193,89,44,0.35), 0 8px 30px rgba(193,89,44,0.18)',
      },
      keyframes: {
        shimmer: {
          from: { backgroundPosition: '190% 0' },
          to: { backgroundPosition: '-90% 0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        'fade-up': 'fade-up 0.5s ease both',
        'spin-slow': 'spin 26s linear infinite',
      },
    },
  },
  plugins: [],
}
