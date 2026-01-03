/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f5f0',
          100: '#b3e0d1',
          200: '#80ccb2',
          300: '#4db893',
          400: '#1aa474',
          500: '#008753', // Nigeria Green
          600: '#006b42',
          700: '#004f31',
          800: '#003320',
          900: '#001710',
        },
      },
    },
  },
  plugins: [],
}

