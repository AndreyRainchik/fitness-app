import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';

const VARIANTS = {
  // Main action on a page or form (save, start, create)
  primary: 'bg-primary-600 text-white shadow-sm hover:bg-primary-500 active:bg-primary-700 disabled:opacity-50',
  // Secondary or cancel actions
  secondary: 'bg-surface text-gray-800 border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50',
  // Quiet filled button (toolbars, inline actions)
  soft: 'bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50',
  // Destructive action inside a confirm dialog
  danger: 'bg-danger-600 text-white shadow-sm hover:bg-danger-500 disabled:opacity-50',
  // Destructive action on a page (less visual weight than `danger`)
  'danger-subtle': 'bg-danger-50 text-danger-700 hover:bg-danger-100 disabled:opacity-50',
  // Positive confirmation (finish workout, mark complete)
  success: 'bg-success-600 text-white shadow-sm hover:bg-success-500 disabled:opacity-50',
  // Text-only action, e.g. "View all"
  ghost: 'text-primary-600 hover:bg-primary-50 disabled:opacity-50',
};

const SIZES = {
  // min-h keeps the height when a stacked layout gives the button flex-basis 0 (flex-1 in a column)
  xs: 'h-8 min-h-[2rem] px-2.5 text-xs rounded-lg',
  sm: 'h-9 min-h-[2.25rem] px-3 text-sm rounded-lg',
  md: 'h-10 min-h-[2.5rem] px-4 text-sm rounded-xl',
  lg: 'h-12 min-h-[3rem] px-5 text-base rounded-xl',
};

const ICON_SIZES = { xs: 'h-8 w-8', sm: 'h-9 w-9', md: 'h-10 w-10', lg: 'h-12 w-12' };

/**
 * The app's one button style.
 *
 * Renders a <Link> when `to` is given, otherwise a <button> (type="button"
 * unless you pass another type). `loading` disables it and shows
 * `loadingText` (or the children) with a spinner. `icon` is a lucide icon
 * component shown before the label; `iconOnly` makes a square button (pass
 * an aria-label).
 */
const Button = forwardRef(function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  loadingText,
  icon: Icon,
  iconOnly = false,
  to,
  type = 'button',
  className = '',
  disabled,
  children,
  ...props
}, ref) {
  const classes = [
    'inline-flex select-none items-center justify-center gap-2 font-semibold whitespace-nowrap',
    'transition-all duration-150 active:scale-[0.98]',
    'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30',
    'disabled:cursor-not-allowed disabled:active:scale-100',
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    iconOnly ? `${ICON_SIZES[size] ?? ICON_SIZES.md} !px-0` : '',
    fullWidth ? 'w-full' : '',
    className,
  ].join(' ');

  const iconEl = Icon ? <Icon className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden="true" strokeWidth={2.25} /> : null;

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {iconEl}
        {children}
      </Link>
    );
  }

  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      ) : iconEl}
      {loading && loadingText ? loadingText : children}
    </button>
  );
});

export default Button;
