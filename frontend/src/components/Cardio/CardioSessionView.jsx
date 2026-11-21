import React from 'react';
import { Card } from '../ui';
import {
  elevationUnit, formatClock, formatDistance, formatPaceOrSpeed, metersToElevation, paceLabel, sportInfo,
} from '../../utils/cardio';
import { formatNumber } from '../../utils/format';

const CADENCE_UNIT = { run: 'spm', ride: 'rpm', row: 'spm' };

/** Stat tiles and notes for one cardio session (workout with `cardio` and `metrics`). */
function CardioSessionView({ workout, unit }) {
  const c = workout.cardio || {};
  const m = workout.metrics || {};
  const info = sportInfo(c.sport);
  const pace = formatPaceOrSpeed(c.sport, c.distance_m, c.duration_s, unit);

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

      {workout.notes && (
        <Card>
          <p className="eyebrow mb-1.5">Notes</p>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{workout.notes}</p>
        </Card>
      )}
    </>
  );
}

export default CardioSessionView;
