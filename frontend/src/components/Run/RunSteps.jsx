import React from 'react';
import { ZONE_COLORS, describeStep, formatPlanDistance } from '../../utils/runPlan';

/**
 * A planned run, step by step, with its pace targets. Optionally shows the
 * session's purpose and coaching cue.
 */
function RunSteps({ run, zones, unit, showCoaching = true }) {
  return (
    <div className="space-y-3">
      {showCoaching && run.purpose && (
        <p className="text-sm text-gray-600">{run.purpose}</p>
      )}
      <ol className="space-y-2">
        {run.steps.map((step, i) => {
          const { title, detail, zones: stepZones } = describeStep(step, zones, unit);
          const color = ZONE_COLORS[stepZones[stepZones.length - 1]] ?? ZONE_COLORS.easy;
          return (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 h-5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{title}</p>
                {detail && <p className="tabular text-xs text-gray-500">{detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-gray-500">About {formatPlanDistance(run.distance_m, unit)} in total</p>
      {showCoaching && run.cue && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"><span className="font-semibold">Coach&apos;s tip:</span> {run.cue}</p>
      )}
    </div>
  );
}

export default RunSteps;
