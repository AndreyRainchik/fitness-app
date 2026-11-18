import React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

const TONES = {
  error: { box: 'bg-danger-50 border-danger-200 text-danger-800', icon: AlertCircle },
  success: { box: 'bg-success-50 border-success-200 text-success-800', icon: CheckCircle2 },
  warning: { box: 'bg-warning-50 border-warning-200 text-warning-800', icon: TriangleAlert },
  info: { box: 'bg-primary-50 border-primary-200 text-primary-800', icon: Info },
};

/** Inline message box. Errors are announced to screen readers immediately. */
function Alert({ tone = 'error', title, children, onDismiss, className = '' }) {
  const { box, icon: Icon } = TONES[tone] ?? TONES.error;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border p-3.5 text-sm ${box} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="-m-1 flex-shrink-0 rounded-md p-1 opacity-60 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default Alert;
