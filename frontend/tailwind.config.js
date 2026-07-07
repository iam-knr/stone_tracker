/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        google: {
          blue: '#1a73e8',
          red: '#ea4335',
          yellow: '#fbbc04',
          green: '#34a853',
          grey: '#f1f3f4',
        },
      },
      fontFamily: { sans: ['Roboto', 'Google Sans', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)' },
    },
  },
  plugins: [],
};
