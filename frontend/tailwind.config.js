/**
 * Every color the app uses is a CSS variable (defined in src/index.css) so
 * the whole UI switches between light and dark themes without per-page
 * `dark:` classes. Values are "R G B" channels so opacity modifiers like
 * `bg-primary-500/20` keep working.
 */
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const palette = (name) =>
  Object.fromEntries(SHADES.map((shade) => [shade, `rgb(var(--${name}-${shade}) / <alpha-value>)`]));

const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        // Neutrals (flip in dark mode)
        gray: palette('gray'),
        slate: palette('gray'),
        // App background, raised panels, and hairlines
        canvas: token('canvas'),
        surface: token('surface'),
        // Semantic colors used by components/ui
        primary: palette('primary'),
        danger: palette('danger'),
        success: palette('success'),
        warning: palette('warning'),
        // Accent families still used by charts, badges and program screens
        purple: palette('purple'),
        orange: palette('orange'),
        yellow: palette('warning'),
        amber: palette('warning'),
        blue: palette('primary'),
        indigo: palette('primary'),
        pink: palette('pink'),
        teal: palette('teal'),
        green: palette('success'),
        red: palette('danger'),
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.02)',
        lift: '0 10px 30px -12px rgb(0 0 0 / 0.25)',
        glow: '0 8px 24px -8px rgb(var(--primary-500) / 0.55)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 250ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
