import React from 'react';
import { Badge, Card } from '../ui';

/**
 * StrengthScoreCard
 * 
 * Displays a summary card for a single lift showing:
 * - Exercise name
 * - Estimated 1RM
 * - Strength standard level
 * - Progress to next level
 * - Recent PR
 */
const LEVEL_TONES = {
  Elite: 'purple',
  Advanced: 'danger',
  Intermediate: 'warning',
  Novice: 'primary',
  Beginner: 'success',
  Untrained: 'neutral',
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * One lift's strength summary: estimated 1RM, standard level, progress to
 * the next level, and the most recent PR.
 */
function StrengthScoreCard({ lift, title }) {
  if (!lift || lift.estimated1RM === 0) {
    return (
      <Card padding="p-4 sm:p-5">
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="mt-1 text-sm text-gray-500">No data yet</p>
      </Card>
    );
  }

  const progress = lift.nextLevel ? Math.min(Math.round((lift.estimated1RM / lift.nextLevel.weight) * 100), 100) : 100;

  return (
    <Card padding="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900">{title}</p>
        <Badge tone={LEVEL_TONES[lift.standard] ?? 'neutral'}>{lift.standard}</Badge>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <p className="tabular text-3xl font-bold tracking-tight text-gray-900">
          {lift.estimated1RM}
          <span className="ml-1 text-sm font-medium text-gray-500">lbs</span>
        </p>
        <p className="text-xs text-gray-500">est. 1RM · {lift.percentile}th pct</p>
      </div>

      {lift.nextLevel && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-primary-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="tabular mt-1.5 flex justify-between gap-2 text-xs text-gray-500">
            <span>{(lift.nextLevel.weight - lift.estimated1RM).toFixed(1)} lbs to {lift.nextLevel.level}</span>
            <span className="font-medium text-gray-700">{lift.nextLevel.weight} lbs</span>
          </p>
        </div>
      )}

      {lift.recentPR && (
        <p className="tabular mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
          Recent PR <span className="font-semibold text-gray-900">{lift.recentPR.weight} × {lift.recentPR.reps}</span> · {fmtDate(lift.recentPR.date)}
        </p>
      )}
    </Card>
  );
}

export default StrengthScoreCard;
