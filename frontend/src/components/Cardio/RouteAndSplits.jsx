import React, { useMemo } from 'react';
import { Map as MapIcon, ListOrdered } from 'lucide-react';
import { Card, CardHeader } from '../ui';
import {
  decodePolyline, elevationUnit, formatClock, metersTo, metersToElevation, sportInfo,
} from '../../utils/cardio';

/**
 * The route's shape, drawn from Strava's summary polyline. No map tiles: just
 * the outline, so nothing is loaded from a third-party map server.
 */
export function RouteOutline({ polyline }) {
  const path = useMemo(() => {
    const points = decodePolyline(polyline);
    if (points.length < 2) return null;
    // Equirectangular projection, shrinking longitude by latitude so shapes aren't stretched
    const midLat = (Math.min(...points.map((p) => p[0])) + Math.max(...points.map((p) => p[0]))) / 2;
    const k = Math.cos((midLat * Math.PI) / 180);
    const xy = points.map(([lat, lng]) => [lng * k, -lat]);
    const xs = xy.map((p) => p[0]);
    const ys = xy.map((p) => p[1]);
    const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
    const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
    const size = 100;
    const scaled = xy.map(([x, y]) => [((x - minX) / span) * size, ((y - minY) / span) * size]);
    const width = (Math.max(...xs) - minX) / span * size;
    const height = (Math.max(...ys) - minY) / span * size;
    const [sx, sy] = scaled[0];
    const [ex, ey] = scaled[scaled.length - 1];
    return {
      // A loop: one dot for start and finish
      loop: Math.hypot(ex - sx, ey - sy) < 4,
      d: scaled.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' '),
      start: scaled[0],
      end: scaled[scaled.length - 1],
      viewBox: `-6 -6 ${width + 12} ${height + 12}`,
    };
  }, [polyline]);

  if (!path) return null;
  return (
    <Card>
      <CardHeader title="Route" icon={MapIcon} />
      <svg viewBox={path.viewBox} className="mx-auto block max-h-72 w-full" role="img" aria-label="Route outline">
        <path d={path.d} fill="none" stroke="rgb(var(--primary-500))" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {!path.loop && <circle cx={path.end[0]} cy={path.end[1]} r="2.6" fill="rgb(var(--danger-500))" stroke="rgb(var(--surface))" strokeWidth="1" />}
        <circle cx={path.start[0]} cy={path.start[1]} r="2.6" fill="rgb(var(--success-500))" stroke="rgb(var(--surface))" strokeWidth="1" />
      </svg>
      <p className="mt-3 flex justify-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success-500" aria-hidden="true" />{path.loop ? 'Start / finish' : 'Start'}</span>
        {!path.loop && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-danger-500" aria-hidden="true" />Finish</span>}
      </p>
    </Card>
  );
}

/**
 * Per-km or per-mile splits (whichever matches the user's unit) from Strava.
 * splitsJson: '{ metric: [...], standard: [...] }'
 */
export function SplitsTable({ splitsJson, sport, unit }) {
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
