import React from 'react';

/**
 * Segmented tab bar. Scrolls sideways on narrow screens.
 *
 *   <Tabs tabs={[{ id: 'a', label: 'A', icon: Dumbbell }]} active={tab} onChange={setTab} label="Profile sections" />
 *
 * Render the active panel yourself below it.
 */
function Tabs({ tabs, active, onChange, label, className = '' }) {
  return (
    <div className={`scrollbar-none overflow-x-auto ${className}`}>
      <nav className="inline-flex min-w-full gap-1 rounded-xl bg-gray-100 p-1 sm:min-w-0" role="tablist" aria-label={label}>
        {tabs.map(({ id, label: tabLabel, icon: Icon }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(id)}
              className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-all sm:flex-none ${
                selected
                  ? 'bg-surface text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
              {tabLabel}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default Tabs;
