import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/**
 * Page title block: optional back link, eyebrow, title, subtitle, and actions.
 * Actions wrap under the title on phones and sit to the right on wider screens.
 */
function PageHeader({ title, subtitle, actions, backTo, backLabel = 'Back', eyebrow }) {
  return (
    <header className="mb-6 sm:mb-8">
      {backTo && (
        <Link
          to={backTo}
          className="-ml-2 mb-2 inline-flex min-h-[40px] items-center gap-0.5 rounded-lg px-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          <h1 className="break-words text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-gray-500 sm:text-base">{subtitle}</div>}
        </div>
        {actions && (
          <div className="flex flex-wrap gap-2 sm:flex-shrink-0 sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

export default PageHeader;
