import React, { useId } from 'react';

/**
 * Label + control + hint/error. Pass the control as a child; it receives the
 * generated id unless it already has one.
 *
 *   <Field label="Email" hint="We never share it"><Input type="email" /></Field>
 */
export function Field({ label, hint, error, className = '', children }) {
  const autoId = useId();
  const child = React.Children.only(children);
  const id = child.props.id ?? autoId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      {React.cloneElement(child, { id, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-danger-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

const SIZE = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-3.5 text-sm', lg: 'h-12 px-4 text-base' };

/** Text input with the app's look. Base styles come from index.css. */
export function Input({ size = 'md', className = '', ...props }) {
  return <input className={`w-full ${SIZE[size] ?? SIZE.md} ${className}`} {...props} />;
}

export function Select({ size = 'md', className = '', children, ...props }) {
  return (
    <select className={`w-full ${SIZE[size] ?? SIZE.md} pr-8 ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`w-full px-3.5 py-2.5 text-sm ${className}`} {...props} />;
}

const BADGE_TONES = {
  neutral: 'bg-gray-100 text-gray-700',
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  purple: 'bg-purple-50 text-purple-700',
};

/** Small colored label. */
export function Badge({ tone = 'neutral', icon: Icon, className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_TONES[tone] ?? BADGE_TONES.neutral} ${className}`}>
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}
