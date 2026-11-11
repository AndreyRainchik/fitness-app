import React, { useEffect, useId, useRef, useState } from 'react';
import { exercisesAPI } from '../../services/api';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

/**
 * Exercise name field with server-side autocomplete.
 *
 * Typing calls onChange(name) (which should clear the matched exercise);
 * picking a suggestion calls onSelect({ id, name, ... }).
 */
function ExerciseNameInput({ value, onChange, onSelect, disabled = false }) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const timerRef = useRef(null);
  // Ignore responses for queries the user has already typed past
  const latestQueryRef = useRef('');

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const close = () => {
    setOpen(false);
    setHighlighted(-1);
  };

  const handleChange = (name) => {
    onChange(name);
    close();
    clearTimeout(timerRef.current);

    const query = name.trim();
    latestQueryRef.current = query;
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        const res = await exercisesAPI.search(query);
        if (latestQueryRef.current !== query) return;
        const list = res?.exercises ?? res ?? [];
        setSuggestions(list);
        setOpen(list.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, DEBOUNCE_MS);
  };

  const select = (suggestion) => {
    onSelect(suggestion);
    setSuggestions([]);
    close();
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(suggestions[highlighted >= 0 ? highlighted : 0]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={close}
        placeholder="Start typing exercise name..."
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        className="w-full border rounded-md px-3 py-2"
        disabled={disabled}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Exercise suggestions"
          className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-auto"
        >
          {suggestions.map((sug, idx) => (
            <li
              key={sug.id ?? `${sug.name}-${idx}`}
              role="option"
              aria-selected={idx === highlighted}
              onMouseDown={(e) => {
                // mousedown fires before the input's blur closes the list
                e.preventDefault();
                select(sug);
              }}
              className={`px-3 py-2 cursor-pointer ${idx === highlighted ? 'bg-primary-100' : 'hover:bg-gray-50'}`}
            >
              <div className="flex justify-between items-center">
                <div className="text-sm font-medium text-gray-900">{sug.name}</div>
                {sug.primary_muscle_group && (
                  <div className="text-xs text-gray-500">{sug.primary_muscle_group}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ExerciseNameInput;
