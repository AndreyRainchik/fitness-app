import React from 'react';
import Card from './Card';

/** Spinning indicator. */
export function Spinner({ className = 'h-8 w-8' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-[3px] border-primary-100 border-t-primary-600 ${className}`}
      aria-hidden="true"
    />
  );
}

/** Shimmering placeholder block. */
export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} aria-hidden="true" />;
}

/** Full-card loading placeholder for a page or section. */
export function LoadingState({ label = 'Loading...' }) {
  return (
    <Card padding="p-12" className="flex flex-col items-center text-center" role="status">
      <Spinner />
      <p className="mt-4 text-sm text-gray-500">{label}</p>
    </Card>
  );
}

/**
 * Placeholder for "nothing here yet" and "couldn't load this".
 * `icon` can be a lucide component or an emoji string.
 * `tone="error"` colors the title red.
 */
export function EmptyState({ icon: Icon, title, description, action, tone = 'neutral' }) {
  return (
    <Card padding="p-8 sm:p-12" className="flex flex-col items-center text-center">
      {Icon && (
        <div
          className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${
            tone === 'error' ? 'bg-danger-50 text-danger-600' : 'bg-primary-50 text-primary-600'
          }`}
          aria-hidden="true"
        >
          {typeof Icon === 'string' ? Icon : <Icon className="h-6 w-6" />}
        </div>
      )}
      <h2 className={`text-lg font-semibold tracking-tight ${tone === 'error' ? 'text-danger-700' : 'text-gray-900'}`}>
        {title}
      </h2>
      {description && <p className="mt-1.5 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </Card>
  );
}

const STAT_TONES = {
  primary: 'bg-primary-50 text-primary-600',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger: 'bg-danger-50 text-danger-600',
  purple: 'bg-purple-50 text-purple-600',
  neutral: 'bg-gray-100 text-gray-700',
};

/** One number with a label, e.g. "Total Volume 12,400 lbs", an optional icon and caption. */
export function StatTile({ label, value, unit, hint, tone = 'primary', icon: Icon }) {
  return (
    <Card padding="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${STAT_TONES[tone] ?? STAT_TONES.primary}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="tabular mt-2 break-words text-xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        {value}
        {unit && <>{' '}<span className="text-sm font-medium text-gray-500 sm:text-base">{unit}</span></>}
      </p>
      {hint && <p className="mt-1 text-xs text-gray-500 sm:text-sm">{hint}</p>}
    </Card>
  );
}
