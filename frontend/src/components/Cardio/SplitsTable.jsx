import React, { useMemo } from 'react';
import { ListOrdered } from 'lucide-react';
import { Card, CardHeader } from '../ui';
import {
  elevationUnit, formatClock, metersTo, metersToElevation, sportInfo,
} from '../../utils/cardio';

/**
 * Per-km or per-mile splits (whichever matches the user's unit) from Strava.
 * splitsJson: '{ metric: [...], standard: [...] }'
 */
function SplitsTable({ splitsJson, sport, unit }) {
  const splits = useMemo(() => {
    try {
      const parsed = JSON.parse(splitsJson || 'null');
      return (unit === 'mi' ? parsed?.standard : parsed?.metric) ?? parsed?.metric ?? parsed?.standard ?? null;
    } catch {
      return null;
    }
  }, [splitsJson, unit]);

  if (!splits?.length || sportInfo(sport).metric !== 'pace') return null;
  const full = unit === 'mi' ? 1609.344 : 1000;
  const paces = splits.map((s) => (s.distance > 0 ? s.moving_time / metersTo(s.distance, unit) : null));
  const fastest = Math.min(...paces.filter((p) => p > 0));
  const slowest = Math.max(...paces.filter((p) => p > 0));

  return (
    <Card>
      <CardHeader title="Splits" subtitle={`Per ${unit === 'mi' ? 'mile' : 'kilometre'}`} icon={ListOrdered} />
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="px-2 py-2 font-medium">{unit}</th>
              <th className="px-2 py-2 font-medium">Pace</th>
              <th className="w-full px-2 py-2 font-medium"><span className="sr-only">Relative pace</span></th>
              <th className="px-2 py-2 text-right font-medium">Elev</th>
              <th className="px-2 py-2 text-right font-medium">HR</th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-gray-100 text-gray-700">
            {splits.map((s, i) => {
              const pace = paces[i];
              // Longer bar = faster split
              const share = pace && slowest > fastest ? 0.35 + 0.65 * ((slowest - pace) / (slowest - fastest)) : 1;
              const partial = s.distance < full * 0.95;
              return (
                <tr key={i}>
                  <td className="px-2 py-2 text-gray-500">{partial ? metersTo(s.distance, unit).toFixed(2) : i + 1}</td>
                  <td className="px-2 py-2 font-medium text-gray-900">{pace ? `${formatClock(pace)} /${unit}` : '—'}</td>
                  <td className="px-2 py-2">
                    {pace && (
                      <span className="block h-2 rounded-full bg-primary-500/70" style={{ width: `${Math.round(share * 100)}%` }} aria-hidden="true" />
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {s.elevation_difference === null || s.elevation_difference === undefined
                      ? '—'
                      : `${s.elevation_difference > 0 ? '+' : ''}${Math.round(metersToElevation(s.elevation_difference, unit))} ${elevationUnit(unit)}`}
                  </td>
                  <td className="px-2 py-2 text-right">{s.average_heartrate ? `${s.average_heartrate}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default SplitsTable;
