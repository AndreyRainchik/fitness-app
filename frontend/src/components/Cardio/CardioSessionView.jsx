import React, { useMemo } from 'react';
import { Card, Skeleton } from '../ui';
import RouteMap from './RouteMap';
import SessionCharts from './SessionCharts';
import ZoneBreakdown from './ZoneBreakdown';
import BestEffortsCard from './BestEffortsCard';
import SplitsTable from './SplitsTable';
import { ViewOnStrava } from '../Strava/StravaConnectionCard';
import {
  decodePolyline, elevationUnit, formatClock, formatDistance, formatPaceOrSpeed, metersToElevation, paceLabel, sportInfo,
} from '../../utils/cardio';
import { formatNumber } from '../../utils/format';
import useSessionAnalysis from '../../utils/useSessionAnalysis';

const CADENCE_UNIT = { run: 'spm', ride: 'rpm', row: 'spm' };

/**
 * One cardio session: stat tiles, then (from its second-by-second data) the
 * route map, charts, heart rate zones and best efforts, then splits and notes.
 */
function CardioSessionView({ workout, unit }) {
  const c = workout.cardio || {};
  const m = workout.metrics || {};
  const info = sportInfo(c.sport);
  const pace = formatPaceOrSpeed(c.sport, c.distance_m, c.duration_s, unit);
  const { analysis, loading } = useSessionAnalysis(workout.id, Boolean(workout.strava));

  // The full GPS track when it's been fetched, else Strava's simplified outline
  const route = useMemo(
    () => analysis?.route ?? (c.summary_polyline ? decodePolyline(c.summary_polyline) : null),
    [analysis?.route, c.summary_polyline]
  );

  const tiles = [
    { label: 'Moving time', value: formatClock(c.duration_s) },
    info.hasDistance && { label: 'Distance', value: formatDistance(c.distance_m, unit) ?? '—' },
    pace && { label: paceLabel(c.sport), value: pace },
    m.avg_hr && { label: 'Avg heart rate', value: m.avg_hr, unit: 'bpm' },
    m.max_hr && { label: 'Max heart rate', value: m.max_hr, unit: 'bpm' },
    m.calories && { label: 'Calories', value: formatNumber(m.calories), unit: 'kcal' },
    c.elevation_gain_m > 0 && { label: 'Elevation gain', value: formatNumber(metersToElevation(c.elevation_gain_m, unit)), unit: elevationUnit(unit) },
    c.avg_cadence > 0 && { label: 'Avg cadence', value: Math.round(c.avg_cadence), unit: CADENCE_UNIT[c.sport] },
  ].filter(Boolean);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">
        {tiles.map((t) => (
          <Card key={t.label} padding="px-3 py-3 sm:p-5">
            <p className="truncate text-xs font-medium text-gray-500 sm:text-sm">{t.label}</p>
            <p className="tabular mt-1 truncate text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
              {t.value}
              {t.unit && <span className="ml-1 text-xs font-medium text-gray-500">{t.unit}</span>}
            </p>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {route && <RouteMap points={route} />}
        {loading && (
          <Card>
            <p className="mb-3 text-sm text-gray-500">Loading heart rate and pace from Strava…</p>
            <Skeleton className="h-40 rounded-xl" />
          </Card>
        )}
        {analysis?.series?.length > 0 && (
          <SessionCharts series={analysis.series} sport={c.sport} environment={c.environment} unit={unit} />
        )}
        {analysis && <ZoneBreakdown zones={analysis.zones} hasHr={analysis.has_hr} />}
        {analysis && <BestEffortsCard efforts={analysis.best_efforts} unit={unit} />}
        {analysis?.status === 'rate_limited' && (
          <p className="text-sm text-gray-500">Strava&apos;s request limit was reached; charts for this session will appear in a while.</p>
        )}
        <SplitsTable splitsJson={c.splits_json} sport={c.sport} unit={unit} />
      </div>

      {workout.notes && (
        <Card className="mt-4">
          <p className="eyebrow mb-1.5">Notes</p>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{workout.notes}</p>
        </Card>
      )}

      {workout.strava && (
        <p className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>Synced from Strava</span>
          <ViewOnStrava activityId={workout.strava.activity_id} />
        </p>
      )}
    </>
  );
}

export default CardioSessionView;
