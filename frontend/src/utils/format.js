import { getLocalDateString } from './dateUtils';

/** Format a 'YYYY-MM-DD' (or ISO) date without timezone drift. */
export function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return '';
  return new Date(`${String(value).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

const dayNumber = (value) => Math.floor(Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`) / 86400000);

/** Whole days from the given date to the user's today (0 = today). */
export function daysAgo(value) {
  return dayNumber(getLocalDateString()) - dayNumber(value);
}

/** "Today", "Yesterday", "3 days ago", else "Nov 3". */
export function relativeDay(value) {
  const diff = daysAgo(value);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return formatDate(value, { month: 'short', day: 'numeric', ...(diff > 300 ? { year: 'numeric' } : {}) });
}

/** 12400 -> "12,400" */
export function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });
}

/** 12400 -> "12.4k" */
export function formatCompact(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}k`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(n));
}

/** Greeting for the time of day. */
export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Chart colors that follow the theme (CSS variables from index.css). */
export const chartColors = {
  grid: 'rgb(var(--gray-200))',
  axis: 'rgb(var(--gray-500))',
  primary: 'rgb(var(--primary-500))',
  primarySoft: 'rgb(var(--primary-200))',
  success: 'rgb(var(--success-500))',
  warning: 'rgb(var(--warning-500))',
  purple: 'rgb(var(--purple-500))',
  danger: 'rgb(var(--danger-500))',
  surface: 'rgb(var(--surface))',
};
