/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0e12',
        panel: '#11161c',
        panel2: '#181f27',
        line: '#2b3540',
        muted: '#84909d',
        accent: '#8fa9bf',
        electric: '#6389a6',
        warning: '#d6a34c',
        danger: '#d46565',
        success: '#6f9f7f',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(143, 169, 191, .10)',
        panel: '0 18px 50px rgba(0,0,0,.28)',
      },
      keyframes: {
        flow: { to: { strokeDashoffset: '-28' } },
        pulseSoft: { '0%,100%': { opacity: .55 }, '50%': { opacity: 1 } },
      },
      animation: { flow: 'flow 1s linear infinite', pulseSoft: 'pulseSoft 2s ease-in-out infinite' },
    },
  },
  plugins: [],
};
