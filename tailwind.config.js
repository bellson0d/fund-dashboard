/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'fund-up': '#a7f3d0',
        'fund-down': '#fecaca',
        'fund-neutral': '#fde68a',
      },
    },
  },
  plugins: [],
}
