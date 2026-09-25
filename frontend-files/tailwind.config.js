/** @type {import('tailwindcss').Config} */
export default {
  content: {
    relative: true,
    files: ['./index.html', './src/**/*.{js,jsx}', '!./src/pages/Register.jsx']
  },
  theme: {
    extend: {
      colors: {
        bg: '#14171C',
        elevated: '#1B1F26',
        line: '#2B313B',
        ink: '#EDEBE5',
        muted: '#9BA3AE',
        gold: '#E8A34C',
        goldDeep: '#C9853A',
        teal: '#4E7C74'
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Inter"', 'sans-serif']
      }
    }
  },
  plugins: []
};
