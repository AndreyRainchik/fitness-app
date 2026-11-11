import React from 'react';

const TONES = {
  error: 'bg-danger-50 border-danger-300 text-danger-800',
  success: 'bg-success-50 border-success-300 text-success-800',
  warning: 'bg-warning-50 border-warning-300 text-warning-800',
  info: 'bg-primary-50 border-primary-200 text-primary-800',
};

/** Inline message box. Errors are announced to screen readers immediately. */
function Alert({ tone = 'error', title, children, onDismiss, className = '' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-lg border p-4 ${TONES[tone] ?? TONES.error} ${className}`}
    >
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-1 text-sm' : ''}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 rounded p-1 opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default Alert;
