import React from 'react';
import { Link } from 'react-router-dom';

const VARIANTS = {
  // Main action on a page or form (save, start, create)
  primary: 'bg-primary-600 hover:bg-primary-700 text-white disabled:bg-primary-300',
  // Secondary or cancel actions
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 disabled:text-gray-400',
  // Destructive action inside a confirm dialog
  danger: 'bg-danger-600 hover:bg-danger-700 text-white disabled:bg-danger-300',
  // Destructive action on a page (less visual weight than `danger`)
  'danger-subtle': 'bg-danger-50 hover:bg-danger-100 text-danger-700 border border-danger-200 disabled:text-danger-300',
  // Text-only action, e.g. "← Back"
  ghost: 'text-primary-600 hover:text-primary-700 hover:bg-primary-50 disabled:text-gray-400',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-base',
};

/**
 * The app's one button style.
 *
 * Renders a <Link> when `to` is given, otherwise a <button> (type="button"
 * unless you pass another type). `loading` disables it and shows
 * `loadingText` (or the children) with a spinner.
 */
function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  loadingText,
  to,
  type = 'button',
  className = '',
  disabled,
  children,
  ...props
}) {
  const classes = [
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed',
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    fullWidth ? 'w-full' : '',
    className,
  ].join(' ');

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      )}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

export default Button;
