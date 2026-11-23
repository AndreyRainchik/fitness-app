import React from 'react';
import { HeartPulse } from 'lucide-react';
import { Button, Card, CardHeader } from '../ui';
import { formatDuration } from '../../utils/cardio';

export const ZONE_COLORS = [1, 2, 3, 4, 5].map((z) => `var(--zone-${z})`);

/**
 * Time in each heart rate zone for one session: a segmented bar, then one
 * row per zone with its range, time and share.
 *
 * zones: { zones: [{ zone, name, min, max }], seconds: [5] } from the analysis
 * endpoint, or null when no heart rate settings are saved (hasHr says whether
 * the session has heart rate data at all).
 */
function ZoneBreakdown({ zones, hasHr }) {
  if (!hasHr) return null;
  if (!zones) {
    return (
      <Card>
        <CardHeader title="Heart rate zones" icon={HeartPulse} />
        <p className="mb-4 text-sm text-gray-600">Set your max heart rate to see how long you spent in each zone.</p>
        <Button variant="secondary" size="sm" to="/profile#heart-rate">Set heart rate zones</Button>
      </Card>
    );
  }

  const total = zones.seconds.reduce((a, b) => a + b, 0) || 1;
  return (
    <Card>
      <CardHeader title="Heart rate zones" icon={HeartPulse} />
      <div className="mb-4 flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {zones.seconds.map((s, i) => s > 0 && (
          <span key={i} style={{ width: `${(s / total) * 100}%`, background: ZONE_COLORS[i] }} />
        ))}
      </div>
      <ul className="space-y-2 text-sm">
        {zones.zones.map((z, i) => {
          const share = Math.round((zones.seconds[i] / total) * 100);
          return (
            <li key={z.zone} className="flex items-center gap-3">
              <span className="h-3 w-3 flex-shrink-0 rounded-sm" style={{ background: ZONE_COLORS[i] }} aria-hidden="true" />
              <span className="w-28 flex-shrink-0 font-medium text-gray-900 sm:w-36">
                Z{z.zone} <span className="font-normal text-gray-500">{z.name}</span>
              </span>
              <span className="tabular hidden flex-1 text-gray-500 sm:block">{z.min}–{z.max} bpm</span>
              <span className="tabular ml-auto text-gray-900">{formatDuration(zones.seconds[i])}</span>
              <span className="tabular w-10 text-right text-gray-500">{share}%</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default ZoneBreakdown;
