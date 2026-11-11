import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from './Modal';
import Button from './Button';
import { FeedbackContext } from './feedback';

const TOAST_TONES = {
  success: 'border-success-500',
  error: 'border-danger-500',
  info: 'border-primary-500',
};

const PROMPT_FORM_ID = 'feedback-prompt-form';

/** The input fields of a usePrompt() dialog. Calls onSubmit({ [name]: value }). */
function PromptForm({ fields, onSubmit }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? '']))
  );

  return (
    <form
      id={PROMPT_FORM_ID}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={`prompt-${field.name}`} className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
          </label>
          <input
            id={`prompt-${field.name}`}
            type={field.type ?? 'text'}
            inputMode={field.inputMode}
            step={field.step}
            min={field.min}
            required={field.required ?? true}
            value={values[field.name]}
            onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      ))}
    </form>
  );
}

/**
 * Provides useConfirm(), usePrompt() and useToast() (see ./feedback.js) to the app.
 * Must sit inside the router, because toast actions can be links.
 */
function FeedbackProvider({ children }) {
  const [dialog, setDialog] = useState(null); // { kind: 'confirm' | 'prompt', options, resolve }
  const [toasts, setToasts] = useState([]);
  const nextToastId = useRef(0);
  const cancelRef = useRef(null);
  const timers = useRef(new Map());

  const openDialog = useCallback((kind, options) => (
    new Promise((resolve) => {
      setDialog((current) => {
        // Only one dialog at a time; a new one cancels the old one
        current?.resolve(current.kind === 'prompt' ? null : false);
        return { kind, options, resolve };
      });
    })
  ), []);

  const confirm = useCallback((options = {}) => openDialog('confirm', options), [openDialog]);
  const prompt = useCallback((options = {}) => openDialog('prompt', options), [openDialog]);

  const closeDialog = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };
  const cancelDialog = () => closeDialog(dialog?.kind === 'prompt' ? null : false);

  const dismissToast = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(({ message, tone = 'info', action, duration }) => {
    nextToastId.current += 1;
    const id = nextToastId.current;
    setToasts((list) => [...list.slice(-2), { id, message, tone, action }]);
    const ms = duration ?? (tone === 'error' ? 7000 : 4000);
    timers.current.set(id, setTimeout(() => dismissToast(id), ms));
  }, [dismissToast]);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => activeTimers.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => ({ confirm, prompt, toast }), [confirm, prompt, toast]);
  const opts = dialog?.options ?? {};
  const isPrompt = dialog?.kind === 'prompt';

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <Modal
        open={!!dialog}
        onClose={cancelDialog}
        title={opts.title ?? (isPrompt ? '' : 'Are you sure?')}
        size="sm"
        // Confirms focus Cancel so a stray Enter can't delete anything;
        // prompts focus their first field
        initialFocusRef={isPrompt ? undefined : cancelRef}
        footer={(
          <>
            <Button ref={cancelRef} variant="secondary" onClick={cancelDialog}>
              {opts.cancelLabel ?? 'Cancel'}
            </Button>
            {isPrompt ? (
              <Button type="submit" form={PROMPT_FORM_ID}>
                {opts.confirmLabel ?? 'OK'}
              </Button>
            ) : (
              <Button variant={opts.tone === 'danger' ? 'danger' : 'primary'} onClick={() => closeDialog(true)}>
                {opts.confirmLabel ?? 'Confirm'}
              </Button>
            )}
          </>
        )}
      >
        {opts.message && <div className="text-gray-700 whitespace-pre-line mb-4">{opts.message}</div>}
        {isPrompt && <PromptForm fields={opts.fields ?? []} onSubmit={(values) => closeDialog(values)} />}
      </Modal>

      <div
        className="pointer-events-none fixed inset-x-4 top-20 z-[60] flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-96"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border-l-4 bg-white p-4 shadow-lg animate-fadeIn ${TOAST_TONES[t.tone] ?? TOAST_TONES.info}`}
          >
            <p className="flex-1 text-sm text-gray-800">{t.message}</p>
            {t.action && (
              <Link
                to={t.action.to}
                onClick={() => dismissToast(t.id)}
                className="text-sm font-semibold text-primary-600 hover:text-primary-700 whitespace-nowrap"
              >
                {t.action.label}
              </Link>
            )}
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export default FeedbackProvider;
