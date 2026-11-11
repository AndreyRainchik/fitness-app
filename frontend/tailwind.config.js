import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Semantic colors used by components/ui. Change a palette here to
      // restyle every button, alert and badge that uses it.
      colors: {
        primary: colors.blue,
        danger: colors.red,
        success: colors.green,
        warning: colors.amber,
      },
    },
  },
  plugins: [],
}
