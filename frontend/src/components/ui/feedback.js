import { createContext, useContext } from 'react';

export const FeedbackContext = createContext(null);

function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useConfirm/usePrompt/useToast must be used inside <FeedbackProvider>');
  }
  return ctx;
}

/**
 * In-app replacement for window.confirm. Returns an async function:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete workout?', confirmLabel: 'Delete', tone: 'danger' }))) return;
 *
 * Options: title, message, confirmLabel ('Confirm'), cancelLabel ('Cancel'),
 * tone ('primary' | 'danger'). Resolves true if confirmed, false otherwise.
 */
export function useConfirm() {
  return useFeedback().confirm;
}

/**
 * In-app replacement for window.prompt, with one or more fields. Returns an
 * async function that resolves to { [field.name]: value } or null if cancelled:
 *
 *   const prompt = usePrompt();
 *   const result = await prompt({
 *     title: 'Duplicate preset',
 *     fields: [{ name: 'name', label: 'New preset name', defaultValue: 'Home (Copy)' }],
 *     confirmLabel: 'Duplicate'
 *   });
 *   if (!result) return;
 *
 * Field options: name, label, defaultValue, type ('text'), inputMode, step,
 * min, required (true).
 */
export function usePrompt() {
  return useFeedback().prompt;
}

/**
 * In-app replacement for window.alert. Returns a function:
 *
 *   const toast = useToast();
 *   toast({ tone: 'error', message: 'Failed to delete workout' });
 *   toast({ tone: 'success', message: 'Template saved', action: { label: 'View', to: '/templates' } });
 *
 * Toasts disappear after a few seconds; errors stay a little longer.
 */
export function useToast() {
  return useFeedback().toast;
}
