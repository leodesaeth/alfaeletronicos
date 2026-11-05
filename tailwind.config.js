/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Paleta Alfa Eletrônicos — Redesign Premium ──────────────
        'ink':         '#111111',
        'graphite':    '#242424',
        'mid-gray':    '#777777',
        'border-gray': '#EAEAEA',
        'warm-white':  '#FAFAF8',
        'pure-white':  '#FFFFFF',
        // Legados admin (preservados)
        'navy':        '#111111',
        'surface':     '#FAFAF8',
        'muted':       '#777777',
        'brand':       '#111111',
        'brand-dark':  '#000000',
        'brand-light': '#242424',
        // WhatsApp
        'whatsapp':      '#25D366',
        'whatsapp-dark': '#1EB854',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card':       '0 2px 8px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.12)',
        'modal':      '0 20px 60px -10px rgba(0,0,0,0.25)',
        'hero':       '0 20px 60px rgba(0,0,0,0.5)',
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'slide-left': 'slideLeft 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideLeft: {
          '0%':   { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
