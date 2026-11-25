import React, { useEffect, useId, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { exercisesAPI } from '../../services/api';
import ExerciseFormModal from './ExerciseFormModal';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

/**
 * Exercise name field with server-side autocomplete.
 *
 * Typing calls onChange(name) (which should clear the matched exercise);
 * picking a suggestion calls onSelect({ id, name, ... }). When nothing in
 * the list has the typed name, a last "Create" row adds it as the user's own
 * exercise and selects it.
 */
function ExerciseNameInput({ value, onChange, onSelect, disabled = false }) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  // The query the current suggestions answer (offered as a new exercise)
  const [searched, setSearched] = useState('');
  const [creating, setCreating] = useState(false);
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
      setSearched('');
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        const res = await exercisesAPI.search(query);
        if (latestQueryRef.current !== query) return;
        const list = res?.exercises ?? res ?? [];
        setSuggestions(list);
        setSearched(query);
        setOpen(true);
      } catch {
        setSuggestions([]);
        setSearched('');
        setOpen(false);
      }
    }, DEBOUNCE_MS);
  };

  const select = (suggestion) => {
    onSelect(suggestion);
    setSuggestions([]);
    setSearched('');
    close();
  };

  const canCreate = searched.length >= MIN_QUERY_LENGTH
    && !suggestions.some((sug) => sug.name.trim().toLowerCase() === searched.toLowerCase());
  const itemCount = suggestions.length + (canCreate ? 1 : 0);

  const startCreate = () => {
    close();
    setCreating(true);
  };

  const choose = (index) => {
    if (index < suggestions.length) select(suggestions[index]);
    else startCreate();
  };

  const handleKeyDown = (e) => {
    if (!open || itemCount === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, itemCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(highlighted >= 0 ? highlighted : 0);
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
        onFocus={() => (suggestions.length > 0 || searched) && setOpen(true)}
        onBlur={close}
        placeholder="Search exercises…"
        aria-label="Exercise name"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        className="h-11 w-full px-3.5 text-[15px] font-semibold"
        disabled={disabled}
      />
      {open && itemCount > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Exercise suggestions"
          className="absolute z-20 mt-1 w-full bg-surface border border-gray-200 rounded-xl shadow-lift max-h-64 overflow-auto p-1"
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
              className={`rounded-lg px-3 py-2 cursor-pointer ${idx === highlighted ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
            >
              <div className="flex justify-between items-center gap-2">
                <div className="text-sm font-medium text-gray-900">{sug.name}</div>
                <div className="flex shrink-0 items-center gap-1.5 text-xs text-gray-500">
                  {sug.is_custom ? <span className="rounded bg-primary-50 px-1.5 py-0.5 font-medium text-primary-700">Yours</span> : null}
                  {sug.primary_muscle_group}
                </div>
              </div>
            </li>
          ))}
          {canCreate && suggestions.length === 0 && (
            <li role="presentation" className="px-3 pt-2 pb-1 text-xs text-gray-500">No exercises match</li>
          )}
          {canCreate && (
            <li
              role="option"
              aria-selected={highlighted === suggestions.length}
              onMouseDown={(e) => {
                e.preventDefault();
                startCreate();
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-sm font-medium text-primary-700 ${highlighted === suggestions.length ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Create “{searched}”</span>
            </li>
          )}
        </ul>
      )}
      <ExerciseFormModal
        open={creating}
        initialName={searched || value}
        onClose={() => setCreating(false)}
        onSaved={(exercise) => {
          setCreating(false);
          select(exercise);
        }}
      />
    </div>
  );
}

export default ExerciseNameInput;
