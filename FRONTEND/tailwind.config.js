/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E6F7F8',
          100: '#C9FCFC',
          200: '#C0F8F8',
          300: '#61C8CF',
          400: '#1E6F7C',
          500: '#186878',
          600: '#105868',
          700: '#0F4C5D',
          800: '#0D495A',
          900: '#084050',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
}