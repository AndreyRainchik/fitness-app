import React from 'react';
import { Trophy } from 'lucide-react';
import { Badge, Card, CardHeader } from '../ui';
import { formatClock, formatPaceOrSpeed } from '../../utils/cardio';

/** Fastest stretches over standard distances within one run. */
function BestEffortsCard({ efforts, unit }) {
  if (!efforts?.length) return null;
  const records = efforts.filter((e) => e.record).length;
  return (
    <Card>
      <CardHeader
        title="Best efforts"
        subtitle={records ? `${records} all-time best${records === 1 ? '' : 's'}` : 'Fastest stretches in this run'}
        icon={Trophy}
      />
      <ul className="divide-y divide-gray-100 text-sm">
        {efforts.map((e) => (
          <li key={e.key} className="flex items-center gap-3 whitespace-nowrap py-2">
            <span className="w-28 shrink-0 font-medium text-gray-900">{e.label}</span>
            <span className="tabular shrink-0 font-semibold text-gray-900">{formatClock(e.seconds)}</span>
            <span className="tabular hidden min-w-0 truncate text-gray-500 min-[400px]:inline">{formatPaceOrSpeed('run', e.meters, e.seconds, unit)}</span>
            {e.record && <Badge tone="warning" icon={Trophy} className="ml-auto shrink-0">Best ever</Badge>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default BestEffortsCard;
