import React from 'react';

/**
 * Underlined tab bar. Scrolls sideways on narrow screens.
 *
 *   <Tabs tabs={[{ id: 'a', label: 'A' }]} active={tab} onChange={setTab} label="Profile sections" />
 *
 * Render the active panel yourself below it.
 */
function Tabs({ tabs, active, onChange, label, className = '' }) {
  return (
    <div className={`border-b border-gray-200 ${className}`}>
      <nav className="-mb-px flex gap-6 sm:gap-8 overflow-x-auto" role="tablist" aria-label={label}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => onChange(tab.id)}
            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
              active === tab.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default Tabs;
