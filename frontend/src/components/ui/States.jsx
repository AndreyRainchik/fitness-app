import React from 'react';
import Card from './Card';

/** Spinning indicator. */
export function Spinner({ className = 'h-10 w-10' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-4 border-primary-100 border-t-primary-600 ${className}`}
      aria-hidden="true"
    />
  );
}

/** Full-card loading placeholder for a page or section. */
export function LoadingState({ label = 'Loading...' }) {
  return (
    <Card padding="p-12" className="text-center" role="status">
      <Spinner />
      <p className="mt-4 text-gray-600">{label}</p>
    </Card>
  );
}

/**
 * Placeholder for "nothing here yet" and "couldn't load this".
 * `tone="error"` colors the title red.
 */
export function EmptyState({ icon, title, description, action, tone = 'neutral' }) {
  return (
    <Card padding="p-8 sm:p-12" className="text-center">
      {icon && <div className="mb-3 text-4xl" aria-hidden="true">{icon}</div>}
      <h2 className={`text-lg sm:text-xl font-semibold ${tone === 'error' ? 'text-danger-700' : 'text-gray-900'}`}>
        {title}
      </h2>
      {description && <p className="mt-2 text-gray-600">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </Card>
  );
}

const STAT_TONES = {
  primary: 'text-primary-600',
  success: 'text-success-600',
  warning: 'text-warning-600',
  neutral: 'text-gray-900',
};

/** One number with a label, e.g. "Total Volume 12,400 lbs", and an optional caption. */
export function StatTile({ label, value, unit, hint, tone = 'primary' }) {
  return (
    <Card>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className={`text-2xl sm:text-3xl font-bold ${STAT_TONES[tone] ?? STAT_TONES.primary}`}>
        {value}
        {unit && <span className="ml-1 text-base sm:text-lg font-semibold">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
    </Card>
  );
}
