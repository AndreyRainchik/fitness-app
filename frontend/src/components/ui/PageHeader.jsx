import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Page title block: optional back link, title, subtitle, and actions.
 * Actions stack under the title on phones and sit to the right on wider screens.
 */
function PageHeader({ title, subtitle, actions, backTo, backLabel = 'Back' }) {
  return (
    <header className="mb-6">
      {backTo && (
        <Link
          to={backTo}
          className="inline-block mb-3 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          ← {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{title}</h1>
          {subtitle && <div className="mt-1 text-sm sm:text-base text-gray-600">{subtitle}</div>}
        </div>
        {actions && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

export default PageHeader;
