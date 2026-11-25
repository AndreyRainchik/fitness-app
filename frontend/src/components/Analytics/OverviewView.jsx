import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CalendarCheck, CheckCircle2, Dumbbell, Gauge, Scale, TrendingUp, Trophy,
} from 'lucide-react';
import { analyticsAPI, cardioAPI } from '../../services/api';
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton, StatTile } from '../ui';
import { formatCompact, formatDate, formatNumber, plural } from '../../utils/format';
import { formatClock, formatDistance, formatDuration } from '../../utils/cardio';
import { FORM_STATUS } from '../../utils/analytics';

const MINUS = '−';
const LIFT_ORDER = ['squat', 'bench', 'deadlift', 'ohp'];

/** 12.5 -> "+12.5", -3 -> "−3", 0 -> "±0" */
function signed(value, digits = 1) {
  const text = formatNumber(Math.abs(value), digits);
  if (value > 0) return `+${text}`;
  if (value < 0) return `${MINUS}${text}`;
  return `±${text}`;
}

/**
 * A change against the previous period. `good` says which direction is good
 * ('up', 'down', or null when neither is, e.g. bodyweight).
 */
function Delta({ value, suffix = '', good = 'up', digits = 1, className = '' }) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const better = good === null || value === 0 ? null : (value > 0) === (good === 'up');
  const tone = better === null ? 'text-gray-500' : better ? 'text-success-600' : 'text-danger-600';
  return <span className={`tabular ${tone} ${className}`}>{signed(value, digits)}{suffix}</span>;
}

const pctChange = (current, previous) => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : null);

/** A small trend line of a lift's per-session best. */
function Sparkline({ points, tone }) {
  if (!points || points.length < 2) return <span className="block h-7 w-16 sm:w-28" aria-hidden="true" />;
  const values = points.map((p) => p.e1rm);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((v, i) => `${(i / (values.length - 1)) * 100},${26 - ((v - min) / span) * 22}`).join(' ');
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={`h-7 w-16 sm:w-28 ${tone}`} aria-hidden="true">
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const LIFT_TONES = {
  up: 'text-success-500',
  stalled: 'text-warning-500',
  down: 'text-danger-500',
};

function liftNote(lift) {
  switch (lift.status) {
    case 'stalled': return `No new best in ${lift.stalledWeeks} weeks`;
    case 'new': return 'New this period';
    case 'notTrained': return 'Not trained this period';
    case 'noData': return 'No data yet';
    default: return plural(lift.sessions, 'session');
  }
}

function LiftRow({ lift, units }) {
  const hasValue = lift.current !== null;
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{lift.label}</p>
        <p className={`text-xs ${lift.status === 'stalled' ? 'text-warning-700' : 'text-gray-500'}`}>{liftNote(lift)}</p>
      </div>
      <Sparkline points={lift.trend} tone={LIFT_TONES[lift.status] ?? 'text-gray-400'} />
      <div className="w-28 flex-shrink-0 text-right sm:w-36">
        {hasValue ? (
          <>
            <p className="tabular text-sm font-semibold text-gray-900">
              {formatNumber(lift.current, 1)} <span className="font-normal text-gray-500">{units}</span>
            </p>
            {lift.change !== null && (
              <p className="text-xs">
                <Delta value={lift.change} />
                {lift.changePct !== null && <span className="tabular text-gray-500"> ({signed(lift.changePct)}%)</span>}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">—</p>
        )}
      </div>
    </li>
  );
}

function StrengthCard({ data, onNavigate }) {
  const { units, total, dots, bodyweight } = data;
  const lifts = LIFT_ORDER.map((k) => data.lifts[k]);
  if (lifts.every((l) => l.status === 'noData')) {
    return (
      <Card>
        <CardHeader title="Are you getting stronger?" icon={TrendingUp} />
        <p className="text-sm text-gray-600">Log squat, bench press, deadlift or overhead press to see how they change from one period to the next.</p>
      </Card>
    );
  }
  const relativeNote = dots.change !== null && total.change !== null && bodyweight.change < 0 && dots.change > 0
    ? 'helped by a lower bodyweight'
    : null;

  return (
    <Card>
      <CardHeader
        title="Are you getting stronger?"
        subtitle={`Best estimated 1RM, compared with the ${data.weeks} weeks before`}
        icon={TrendingUp}
        action={<Button variant="ghost" size="sm" onClick={() => onNavigate('progression')}>Progression</Button>}
      />
      <ul className="-my-1 divide-y divide-gray-100">
        {lifts.map((lift) => <LiftRow key={lift.key} lift={lift} units={units} />)}
      </ul>
      {(total.current || dots.current) && (
        <div className="mt-3 flex flex-col gap-1 border-t border-gray-100 pt-3 text-sm text-gray-600 sm:flex-row sm:items-baseline sm:justify-between">
          {total.current && (
            <p>
              Total <span className="tabular font-semibold text-gray-900">{formatNumber(total.current, 1)} {units}</span>
              {total.change !== null && <> <Delta value={total.change} /></>}
            </p>
          )}
          {dots.current && (
            <p>
              DOTS <span className="tabular font-semibold text-gray-900">{formatNumber(dots.current, 1)}</span>
              {dots.change !== null && <> <Delta value={dots.change} /></>}
              {relativeNote && <span className="text-gray-500"> · {relativeNote}</span>}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

const FLAG_TAB_LABELS = { progression: 'Progression', symmetry: 'Balance', load: 'Training load', endurance: 'Endurance' };

/** Flags from the server, plus a fatigue warning from the training load. */
function flagsWithLoad(flags, load) {
  const today = load?.today;
  if (!today || load.needs_thresholds) return flags;
  const extra = [];
  if (today.status === 'overreaching') {
    extra.push({ id: 'overreaching', tone: 'warning', tab: 'load', title: 'Fatigue is running high', detail: 'Your form is well below zero. A few easier days will let your fitness catch up.' });
  } else if (today.ratio >= 1.5 && today.fitness >= 10) {
    extra.push({ id: 'spike', tone: 'warning', tab: 'load', title: `This week's load is ${today.ratio}× your usual`, detail: 'Sharp jumps in load raise injury risk. Ease in if it wasn’t planned.' });
  }
  const warnings = flags.filter((f) => f.tone === 'warning');
  return [...warnings, ...extra, ...flags.filter((f) => f.tone !== 'warning')];
}

function FlagsCard({ flags, onNavigate }) {
  return (
    <Card>
      <CardHeader title="Worth a look" icon={AlertTriangle} />
      {flags.length === 0 ? (
        <p className="text-sm text-gray-600">Nothing stands out this period. Keep training and check back.</p>
      ) : (
        <ul className="-my-1 divide-y divide-gray-100">
          {flags.map((flag) => {
            const Icon = flag.tone === 'success' ? CheckCircle2 : AlertTriangle;
            return (
              <li key={flag.id} className="flex items-start gap-3 py-3">
                <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${flag.tone === 'success' ? 'text-success-600' : 'text-warning-600'}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{flag.title}</p>
                  <p className="text-sm text-gray-500">{flag.detail}</p>
                </div>
                {FLAG_TAB_LABELS[flag.tab] && (
                  <Button variant="ghost" size="xs" className="flex-shrink-0" onClick={() => onNavigate(flag.tab)} aria-label={`Open ${FLAG_TAB_LABELS[flag.tab]}`}>
                    <span className="hidden sm:inline">{FLAG_TAB_LABELS[flag.tab]}</span>
                    <ArrowRight className="h-4 w-4 sm:hidden" aria-hidden="true" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function TrainingMixCard({ data, distanceUnit, onNavigate }) {
  const { current } = data.summary;
  const time = current.strengthDurationS + current.cardioDurationS;
  const strengthPct = time > 0 ? Math.round((current.strengthDurationS / time) * 100) : 0;
  const { running } = data;
  const tenKChange = running.current && running.previous ? running.current.tenK - running.previous.tenK : null;

  return (
    <Card>
      <CardHeader
        title="Training mix"
        subtitle={time > 0 ? `${formatDuration(time)} in ${plural(current.sessions, 'session')}` : 'No session times logged'}
        icon={Dumbbell}
        action={<Button variant="ghost" size="sm" onClick={() => onNavigate('endurance')}>Endurance</Button>}
      />
      {time > 0 && (
        <>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100" role="img" aria-label={`Strength ${strengthPct}%, cardio ${100 - strengthPct}%`}>
            <div className="h-full" style={{ width: `${strengthPct}%`, background: 'var(--activity-strength)' }} />
            <div className="h-full" style={{ width: `${100 - strengthPct}%`, background: 'var(--activity-run)' }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: 'var(--activity-strength)' }} aria-hidden="true" />
              Strength {strengthPct}% · {formatDuration(current.strengthDurationS)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: 'var(--activity-run)' }} aria-hidden="true" />
              Cardio {100 - strengthPct}% · {formatDuration(current.cardioDurationS)}
            </span>
          </div>
        </>
      )}
      {(current.runDistanceM > 0 || running.current) && (
        <dl className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-sm">
          {current.runDistanceM > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Running</dt>
              <dd className="tabular font-medium text-gray-900">{formatDistance(current.runDistanceM, distanceUnit, 1)}</dd>
            </div>
          )}
          {running.current && (
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Predicted 10K</dt>
              <dd className="tabular font-medium text-gray-900">
                {formatClock(running.current.tenK)}
                {tenKChange !== null && tenKChange !== 0 && (
                  <span className={`ml-1.5 font-normal ${tenKChange < 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {tenKChange < 0 ? MINUS : '+'}{formatClock(Math.abs(tenKChange))}
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>
      )}
    </Card>
  );
}

function RightNowCard({ load, onNavigate }) {
  const action = <Button variant="ghost" size="sm" onClick={() => onNavigate('load')}>Training load</Button>;
  if (!load) return <Skeleton className="h-48 rounded-2xl" />;
  if (load.needs_thresholds || !load.today || load.daily?.every((d) => d.fitness === 0)) {
    return (
      <Card>
        <CardHeader title="Right now" icon={Gauge} action={load.needs_thresholds ? null : action} />
        {load.needs_thresholds ? (
          <>
            <p className="mb-4 text-sm text-gray-600">Set your max heart rate to see your fitness, fatigue and form.</p>
            <Button variant="secondary" size="sm" to="/profile#heart-rate">Set heart rate zones</Button>
          </>
        ) : (
          <p className="text-sm text-gray-600">Log or sync some sessions to see your fitness and form.</p>
        )}
      </Card>
    );
  }
  const { today } = load;
  const status = FORM_STATUS[today.status];
  const tiles = [
    { label: 'Fitness', value: formatNumber(today.fitness) },
    { label: 'Fatigue', value: formatNumber(today.fatigue) },
    { label: 'Form', value: `${today.form > 0 ? '+' : today.form < 0 ? MINUS : ''}${formatNumber(Math.abs(today.form))}` },
  ];
  return (
    <Card>
      <CardHeader title="Right now" icon={Gauge} action={action} />
      <div className="mb-3 flex items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs font-medium text-gray-500">{t.label}</p>
            <p className="tabular text-lg font-bold text-gray-900">{t.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-gray-600">{status.text}</p>
    </Card>
  );
}

/**
 * Analytics > Overview: how the selected period went compared with the one
 * before, with links to the tab that has the details. `onNavigate(tabId)`
 * switches the Analytics tab.
 */
function OverviewView({ weeks, distanceUnit, onNavigate }) {
  const [data, setData] = useState(null);
  const [load, setLoad] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    setData(null);
    analyticsAPI.getOverview(weeks)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load the overview'); });
    // Training load is a nice-to-have here; its own tab shows any error
    cardioAPI.getLoad(weeks)
      .then((result) => { if (!cancelled) setLoad(result); })
      .catch(() => { if (!cancelled) setLoad({ needs_thresholds: false, today: null }); });
    return () => { cancelled = true; };
  }, [weeks]);

  if (error) return <EmptyState tone="error" title="Couldn't load the overview" description={error} />;
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const { summary, units, bodyweight, prs, windows } = data;
  const { current, previous } = summary;
  if (current.sessions === 0 && previous.sessions === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No training in this range"
        description="Log some workouts and this page will show how each period compares with the one before."
        action={<Button to="/workout/new">Log a workout</Button>}
      />
    );
  }

  const biggest = prs.current.biggest;
  const flags = flagsWithLoad(data.flags, load);

  return (
    <div className="space-y-4 sm:space-y-6">
      <p className="text-sm text-gray-500">
        {formatDate(windows.current.start)} – {formatDate(windows.current.end)}, compared with the {weeks} weeks before
      </p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          label="Sessions"
          value={current.sessions}
          icon={CalendarCheck}
          hint={(
            <>
              <Delta value={current.sessions - previous.sessions} digits={0} /> · {formatNumber(current.perWeek, 1)}/week
            </>
          )}
        />
        <StatTile
          label="Strength volume"
          value={formatCompact(current.volume)}
          unit={units}
          icon={Dumbbell}
          tone="purple"
          hint={pctChange(current.volume, previous.volume) !== null
            ? <Delta value={pctChange(current.volume, previous.volume)} suffix="%" digits={0} />
            : 'Working sets'}
        />
        <StatTile
          label="PRs"
          value={prs.current.count}
          icon={Trophy}
          tone="warning"
          hint={biggest
            ? <span className="block truncate">Biggest: {biggest.exercise.replace(/^Barbell /, '')} +{formatNumber(biggest.gainPct, 1)}%</span>
            : prs.current.count > 0 ? plural(prs.current.exercises, 'exercise') : 'None this period'}
        />
        <StatTile
          label="Bodyweight"
          value={bodyweight.current ? formatNumber(bodyweight.current, 1) : '—'}
          unit={bodyweight.current ? units : null}
          icon={Scale}
          tone="neutral"
          hint={bodyweight.change !== null
            ? <><Delta value={bodyweight.change} good={null} /> {units}</>
            : bodyweight.current ? 'Log weigh-ins to see a trend' : 'Not logged'}
        />
      </div>

      <StrengthCard data={data} onNavigate={onNavigate} />
      <FlagsCard flags={flags} onNavigate={onNavigate} />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <TrainingMixCard data={data} distanceUnit={distanceUnit} onNavigate={onNavigate} />
        <RightNowCard load={load} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export default OverviewView;
