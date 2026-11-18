# Layout Components

## Layout (`Layout.jsx`)

App shell for every signed-in page.

- **Desktop (lg+)**: fixed left sidebar with the "Start / Resume workout"
  button, navigation (from `nav.js`), theme switch, and account row.
- **Phones/tablets**: sticky top bar (logo + avatar) and a bottom tab bar
  (Home, History, start button, Analytics, More). "More" opens a bottom
  sheet with every page, the theme switch and sign out.
- Shows a "Workout in progress" banner on any page (except the dashboard,
  which has its own card) while an Active Workout draft exists.

```jsx
import Layout from '../components/Layout/Layout';

<Layout>…</Layout>                       // standard page, max-w-6xl
<Layout width="max-w-3xl">…</Layout>     // narrower content column
<Layout focus>…</Layout>                 // no navigation chrome (Active Workout)
```

To add a page to the navigation, add an entry to `NAV_ITEMS` in `nav.js`
(`mobile: true` gives it a bottom-bar slot; there are three).

## AuthLayout (`AuthLayout.jsx`)

Split-screen frame used by Login and Register: brand panel on the left
(desktop only) and the form on the right.

```jsx
<AuthLayout title="Welcome back" subtitle="…" footer={<>…</>}>
  <form>…</form>
</AuthLayout>
```

## ThemeToggle (`ThemeToggle.jsx`)

Light / System / Dark switch backed by `context/ThemeContext.jsx`. The
choice is stored in `localStorage.theme`; `index.html` applies it before
first paint so there is no flash.

## Theming

Colors are CSS variables defined in `src/index.css` (`:root` for light,
`.dark` for dark) and mapped to Tailwind colors in `tailwind.config.js`.
Use the normal Tailwind names (`bg-surface`, `bg-canvas`, `text-gray-900`,
`bg-primary-600`, …) and both themes work without `dark:` classes.
