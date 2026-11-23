import React, { useState } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { Badge } from '../ui';
import { formatDate } from '../../utils/format';
import {
  PHASE_LABELS, ZONE_LABELS, ZONE_TONES, formatPlanDistance, mainSetSummary, paceRange,
} from '../../utils/runPlan';
import RunSteps from './RunSteps';

const PHASE_TONES = {
  base: 'neutral', build: 'primary', peak: 'warning', taper: 'success', race: 'purple', maintain: 'neutral',
};

/** The plan's pace zones, fastest last. */
export function PaceTable({ zones, unit, zoneInfo = [] }) {
  const order = ['recovery', 'easy', 'steady', 'marathon', 'half', 'threshold', '10k', '5k', 'interval', 'rep', 'goal'];
  const feel = new Map(zoneInfo.map((z) => [z.id, z.feel]));
  return (
    <ul className="divide-y divide-gray-100">
      {order.filter((z) => zones?.[z]).map((zone) => (
        <li key={zone} className="flex items-center gap-3 py-2">
          <span className={`w-2 self-stretch rounded-full ${ZONE_TONES[zone]}`} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium capitalize text-gray-900">{ZONE_LABELS[zone]}</span>
            {feel.get(zone) && <span className="block text-xs text-gray-500">{feel.get(zone)}</span>}
          </span>
          <span className="tabular text-sm font-semibold text-gray-900">{paceRange(zones, zone, unit)}</span>
        </li>
      ))}
    </ul>
  );
}

function RunRow({ run, zones, unit, today }) {
  const [open, setOpen] = useState(false);
  const summary = mainSetSummary(run.steps, unit);
  const past = today && run.date < today;
  return (
    <li className={past ? 'opacity-60' : ''}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
      >
        <span className="w-20 flex-shrink-0 text-xs text-gray-500">{formatDate(run.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
            {run.key && <Star className="h-3.5 w-3.5 flex-shrink-0 text-warning-500" aria-label="Key session" />}
            <span className="truncate">{run.title}</span>
            {run.status === 'done' && <Badge tone="success">Done</Badge>}
          </span>
          {summary && <span className="block truncate text-xs text-gray-500">{summary}</span>}
        </span>
        <span className="tabular text-sm text-gray-700">{formatPlanDistance(run.distance_m, unit)}</span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="mb-2 ml-2 mt-1 border-l-2 border-gray-100 pl-4 sm:ml-24">
          <RunSteps run={run} zones={zones} unit={unit} />
        </div>
      )}
    </li>
  );
}

/** Every week of a plan, with its runs; tap a run for its steps. */
function PlanWeeks({ weeks, zones, unit, today = null }) {
  return (
    <div className="space-y-3">
      {weeks.map((week) => {
        const current = today && week.week_start <= today && today < addDays(week.week_start, 7);
        return (
          <section
            key={week.index}
            className={`rounded-2xl border bg-surface p-3 sm:p-4 ${current ? 'border-primary-300 ring-2 ring-primary-500/30' : 'border-gray-200/80'}`}
            aria-current={current ? 'date' : undefined}
          >
            <header className="mb-1 flex flex-wrap items-center gap-2 px-2">
              <h3 className="text-sm font-semibold text-gray-900">Week {week.index + 1}</h3>
              <span className="text-xs text-gray-500">{formatDate(week.week_start)}</span>
              <Badge tone={PHASE_TONES[week.phase] ?? 'neutral'}>{PHASE_LABELS[week.phase] ?? week.phase}</Badge>
              {week.cutback && <Badge tone="success">Easier week</Badge>}
              {current && <Badge tone="primary">This week</Badge>}
              <span className="tabular ml-auto text-xs font-medium text-gray-600">{formatPlanDistance(week.total_m, unit)}</span>
            </header>
            <ul>
              {week.runs.map((run) => <RunRow key={run.id ?? `${run.date}-${run.session_id}`} run={run} zones={zones} unit={unit} today={today} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

export default PlanWeeks;
