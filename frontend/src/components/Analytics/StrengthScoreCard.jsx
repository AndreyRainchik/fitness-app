import React from 'react';
import { Badge, Card } from '../ui';
import { formatNumber } from '../../utils/format';
import { LEVEL_TONES, levelProgress } from '../../utils/analytics';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Bar showing progress to the next strength level, with how much is left
 * and the next level's weight. `lift` is one lift from the strength score.
 */
export function LevelProgressBar({ lift, units }) {
  if (!lift.nextLevel) {
    return <p className="text-xs font-medium text-purple-700">Top level reached</p>;
  }
  const progress = levelProgress(lift);
  const remaining = Math.max(lift.nextLevel.weight - lift.estimated1RM, 0);
  return (
    <div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${progress}% of the way to ${lift.nextLevel.level}`}
      >
        <div className="h-full rounded-full bg-primary-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="tabular mt-1.5 flex justify-between gap-2 text-xs text-gray-500">
        <span>{formatNumber(remaining, 1)} {units} to {lift.nextLevel.level}</span>
        <span className="font-medium text-gray-700">{formatNumber(lift.nextLevel.weight, 1)} {units}</span>
      </p>
    </div>
  );
}

/**
 * One lift's strength summary: estimated 1RM, standard level, progress to
 * the next level, and the most recent PR. Weights are in `units`.
 */
function StrengthScoreCard({ lift, title, units = 'lbs' }) {
  if (!lift || lift.estimated1RM === 0) {
    return (
      <Card padding="p-4 sm:p-5">
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="mt-1 text-sm text-gray-500">No data yet</p>
      </Card>
    );
  }

  return (
    <Card padding="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900">{title}</p>
        <Badge tone={LEVEL_TONES[lift.standard] ?? 'neutral'}>{lift.standard}</Badge>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <p className="tabular text-3xl font-bold tracking-tight text-gray-900">
          {lift.estimated1RM}
          <span className="ml-1 text-sm font-medium text-gray-500">{units}</span>
        </p>
        <p className="text-xs text-gray-500">est. 1RM · {lift.percentile}th pct</p>
      </div>

      <div className="mt-3">
        <LevelProgressBar lift={lift} units={units} />
      </div>

      {lift.recentPR && (
        <p className="tabular mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
          Best set <span className="font-semibold text-gray-900">{lift.recentPR.weight} × {lift.recentPR.reps}</span> · {fmtDate(lift.recentPR.date)}
        </p>
      )}
    </Card>
  );
}

export default StrengthScoreCard;
