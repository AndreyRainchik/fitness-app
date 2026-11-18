import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const OPTIONS = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'dark', label: 'Dark', icon: Moon },
];

/** Three-way light / system / dark switch. */
function ThemeToggle({ className = '' }) {
  const { preference, setPreference } = useTheme();
  return (
    <div className={`flex gap-1 rounded-xl bg-gray-100 p-1 ${className}`} role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={preference === id}
          title={label}
          onClick={() => setPreference(id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
            preference === id ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

export default ThemeToggle;
