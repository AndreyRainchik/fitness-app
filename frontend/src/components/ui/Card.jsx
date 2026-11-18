import React from 'react';

/** Raised panel used for every content block. */
function Card({ className = '', padding = 'p-4 sm:p-6', children, ...props }) {
  return (
    <div className={`bg-surface rounded-2xl border border-gray-200/80 shadow-card ${padding} ${className}`} {...props}>
      {children}
    </div>
  );
}

/** Card title row: heading on the left, optional action on the right. */
export function CardHeader({ title, subtitle, action, icon: Icon, className = '' }) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-gray-900 sm:text-lg">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export default Card;
