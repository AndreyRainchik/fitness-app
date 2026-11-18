import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog box. Closes on Escape and on a backdrop click (unless
 * `dismissible` is false), moves focus into the dialog when it opens (to
 * `initialFocusRef`, else the first field in the body) and back to where it
 * was when it closes, and stops the page behind it from scrolling.
 */
function Modal({ open, onClose, title, children, footer, size = 'md', dismissible = true, initialFocusRef }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const bodyRef = useRef(null);

  // Read the latest values without re-running the open/close effect
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    // Prefer the first field in the body over the header's close button
    const target = initialFocusRef?.current
      ?? bodyRef.current?.querySelector(FOCUSABLE)
      ?? panelRef.current?.querySelector(FOCUSABLE)
      ?? panelRef.current;
    target?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && dismissibleRef.current) {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      // Keep Tab inside the dialog
      if (e.key === 'Tab' && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll(FOCUSABLE)];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  const width = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' }[size] ?? 'max-w-md';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-950/40 p-0 backdrop-blur-sm sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`w-full ${width} max-h-[90vh] overflow-y-auto rounded-t-3xl border border-gray-200/80 bg-surface shadow-lift focus:outline-none animate-slide-up pb-safe sm:rounded-2xl sm:pb-0`}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-1">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-gray-900">{title}</h2>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                className="-m-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              ><X className="h-5 w-5" /></button>
            )}
          </div>
        )}
        <div ref={bodyRef} className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 px-5 pb-5 pt-2 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
