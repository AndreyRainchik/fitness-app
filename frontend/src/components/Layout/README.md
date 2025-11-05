# Layout Components

## Overview

The Layout system provides a consistent navigation experience across all authenticated pages.

## Components

### Layout (`/src/components/Layout/Layout.jsx`)

Main wrapper component that provides:
- Header with navigation
- Main content area
- Footer
- Consistent spacing and styling

**Usage:**
```javascript
import Layout from '../components/Layout/Layout';

function MyPage() {
  return (
    <Layout>
      <h1>My Page Content</h1>
      {/* Your page content here */}
    </Layout>
  );
}
```

### Header (`/src/components/Layout/Header.jsx`)

Navigation header component that includes:
- Brand logo (clickable, links to dashboard)
- Navigation menu (Dashboard, Workouts, Analytics, Programs)
- Active route highlighting
- User info display
- Logout button
- Responsive mobile menu

**Features:**
- ✅ Active link highlighting (blue background)
- ✅ Hover effects
- ✅ Mobile responsive with hamburger menu
- ✅ Uses React Router's `useLocation` for active state
- ✅ Mobile menu closes automatically after navigation
- ✅ Smooth toggle animation

## Responsive Behavior

### Desktop (≥768px)
- Horizontal navigation bar in header
- All links visible
- User info and logout on right side

### Mobile (<768px)
- Hamburger menu icon (☰) on right side
- Tap to open dropdown menu
- Menu shows all navigation links
- User info and logout button at bottom of menu
- Menu closes automatically when you select a link
- Icon changes to X (✕) when menu is open

**Mobile Menu States:**
```
Closed: Shows ☰ (hamburger icon)
Open:   Shows ✕ (close icon)
        Dropdown with all links
        User info
        Logout button
```

## Pages Using Layout

All authenticated pages use the Layout component:

- ✅ Dashboard (`/dashboard`)
- ✅ Workouts (`/workouts`)
- ✅ Analytics (`/analytics`)
- ✅ Programs (`/program`)

## Pages NOT Using Layout

Public pages have their own custom layouts:

- ❌ Home (`/`) - Custom landing page design
- ❌ Login (`/login`) - Centered auth form
- ❌ Register (`/register`) - Centered auth form

## Navigation Flow

```
User logs in
    ↓
Dashboard (with Header)
    ↓
Can navigate to:
- Workouts (Header stays)
- Analytics (Header stays)
- Programs (Header stays)
- Back to Dashboard (Header stays)
```

## Styling

**Color Scheme:**
- Header: Blue gradient (`bg-blue-600`)
- Active link: Dark blue (`bg-blue-700`)
- Hover: Dark blue (`hover:bg-blue-700`)
- Content: Light gray background (`bg-gray-100`)
- Mobile menu: White background with shadow

**Responsive:**
- Desktop: Horizontal nav menu in header, inline user menu
- Mobile: Hamburger button, dropdown menu with all options

**Mobile Menu:**
- White card with rounded corners and shadow
- Gray text with blue hover states
- Active link has blue background
- User section separated by border
- Full-width logout button

## Future Enhancements

Planned improvements:
- [ ] User profile dropdown
- [ ] Notifications badge
- [ ] Quick actions menu
- [ ] Theme toggle (dark mode)
- [ ] Breadcrumb navigation
- [ ] Mobile hamburger menu

## Component Structure

```
<Layout> (flex flex-col min-h-screen)
  ├── <Header>
  │   ├── Brand/Logo
  │   ├── Navigation Links
  │   └── User Menu
  ├── <main> (flex-grow bg-gray-100)
  │   └── <div> (container mx-auto px-4 py-8)
  │       └── {children} (Page content)
  └── <footer> (bg-white border-t)
      └── Copyright info
```

**Sticky Footer Implementation:**
- Container uses `flex flex-col min-h-screen` (flexbox column, full viewport height)
- Main content uses `flex-grow` (expands to fill available space)
- Footer naturally sticks to bottom whether content is short or long

## Testing Navigation

To test the layout:

1. Navigate to any protected page (e.g., `/dashboard`)
2. You should see:
   - Blue header with logo
   - Navigation links
   - Current page highlighted
   - Logout button
   - Footer at bottom
3. Click different nav links - header persists
4. Try on mobile (resize browser) - responsive layout works

## Code Examples

### Adding Layout to a New Page

```javascript
import React from 'react';
import Layout from '../components/Layout/Layout';

function NewPage() {
  return (
    <Layout>
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">New Page</h1>
        <p className="text-gray-600">Description of the page</p>
      </header>
      
      <div className="bg-white rounded-lg shadow p-6">
        {/* Your content here */}
      </div>
    </Layout>
  );
}

export default NewPage;
```

### Customizing the Header

To modify navigation links, edit `/src/components/Layout/Header.jsx`:

```javascript
<Link to="/new-route" className={navLinkClass('/new-route')}>
  New Link
</Link>
```

The `navLinkClass` function automatically handles active state styling.

## Notes

- Layout automatically provides consistent margins and padding
- All pages inside Layout have `container mx-auto px-4 py-8`
- Footer sticks to bottom with `mt-auto`
- Header shadow provides visual separation