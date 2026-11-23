import { CalendarCheck, CalendarDays, CalendarRange, ChartColumn, ClipboardList, History, House, User } from 'lucide-react';

/** Primary destinations, in sidebar order. `mobile` ones get a bottom-bar slot. */
export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Home', icon: House, mobile: true },
  { to: '/week', label: 'My Week', icon: CalendarDays, mobile: true },
  { to: '/workouts', label: 'History', icon: History, mobile: true, match: ['/workouts', '/workout/'] },
  { to: '/templates', label: 'Templates', icon: ClipboardList },
  { to: '/current-week', label: 'Program Week', icon: CalendarCheck },
  { to: '/programs', label: 'Programs', icon: CalendarRange },
  { to: '/analytics', label: 'Analytics', icon: ChartColumn, mobile: true },
  { to: '/profile', label: 'Profile', icon: User },
];

export function isActivePath(pathname, item) {
  if (pathname === '/workout/new' || pathname === '/workout/active') return item.to === pathname;
  const prefixes = item.match ?? [item.to];
  return prefixes.some((p) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : `${p}/`));
}
