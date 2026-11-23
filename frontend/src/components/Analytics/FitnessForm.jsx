import React, { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, BatteryMedium, Gauge, TrendingUp } from 'lucide-react';
import { cardioAPI } from '../../services/api';
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton } from '../ui';
import { chartColors, formatDate, formatNumber } from '../../utils/format';

const FITNESS = 'var(--load-fitness)';
const FATIGUE = 'var(--load-fatigue)';

const FORM_STATUS = {
  fresh: { label: 'Fresh', tone: 'success', text: 'Rested. A good time to race or test yourself.' },
  neutral: { label: 'Neutral', tone: 'neutral', text: 'Training and recovery are balanced; fitness is holding.' },
  productive: { label: 'Productive', tone: 'primary', text: 'Building fitness, with fatigue in a healthy range.' },
  overreaching: { label: 'Overreaching', tone: 'danger', text: 'Fatigue is high. Plan a few easier days.' },
};

// Acute:chronic ratio above this, with some fitness built, is a load spike
const SPIKE_RATIO = 1.5;
const MIN_FITNESS_FOR_SPIKE = 10;

function DayTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload;
  return (
    <div className="rounded-xl border border-gray-200 bg-surface px-3 py-2 text-xs shadow-lift">
      <p className="font-semibold text-gray-900">{formatDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
      <p className="tabular flex items-center gap-2 text-gray-600">
        <span className="h-0.5 w-3 rounded" style={{ background: FITNESS }} aria-hidden="true" />Fitness <span className="ml-auto text-gray-900">{day.fitness}</span>
      </p>
      <p className="tabular flex items-center gap-2 text-gray-600">
        <span className="h-0.5 w-3 rounded" style={{ background: FATIGUE }} aria-hidden="true" />Fatigue <span className="ml-auto text-gray-900">{day.fatigue}</span>
      </p>
      <p className="tabular flex gap-2 text-gray-600">Form <span className="ml-auto text-gray-900">{day.form > 0 ? '+' : ''}{day.form}</span></p>
      {day.load > 0 && <p className="tabular mt-1 text-gray-500">Load that day: {day.load}</p>}
    </div>
  );
}

const axisProps = {
  tick: { fill: chartColors.axis, fontSize: 11 },
  axisLine: false,
  tickLine: false,
};

/** Fitness and fatigue lines, then form below on its own scale, hover shared. */
function Curves({ daily, height = 'h-48 sm:h-56' }) {
  const formValues = daily.map((d) => d.form);
  const formMin = Math.min(-40, Math.floor(Math.min(...formValues) / 10) * 10);
  const formMax = Math.max(10, Math.ceil(Math.max(...formValues) / 10) * 10);
  // Round steps: every 10, or every 20 when the range is wide
  const step = formMax - formMin > 80 ? 20 : 10;
  const formTicks = [];
  for (let t = Math.ceil(formMin / step) * step; t <= formMax; t += step) formTicks.push(t);
  const xAxis = (
    <XAxis dataKey="date" tickFormatter={(v) => formatDate(v)} interval="preserveStartEnd" minTickGap={28} {...axisProps} />
  );
  return (
    <div className="space-y-4">
      <div>
        <ul className="mb-2 flex gap-4 text-xs text-gray-600" aria-label="Legend">
          <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: FITNESS }} aria-hidden="true" />Fitness (42-day)</li>
          <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: FATIGUE }} aria-hidden="true" />Fatigue (7-day)</li>
        </ul>
        <div className={height}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} syncId="fitness-form" margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={chartColors.grid} strokeDasharray="3 3" />
              {xAxis}
              <YAxis width={40} {...axisProps} />
              <Tooltip content={<DayTooltip />} cursor={{ stroke: chartColors.axis, strokeDasharray: '3 3' }} />
              <Line type="monotone" dataKey="fitness" stroke={FITNESS} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="fatigue" stroke={FATIGUE} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs text-gray-600">Form (fitness − fatigue)</p>
        <div className="h-32 sm:h-36">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} syncId="fitness-form" margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <ReferenceArea y1={-30} y2={-10} fill="rgb(var(--primary-500))" fillOpacity={0.08} ifOverflow="hidden"
                label={{ value: 'Productive', position: 'insideTopLeft', fill: chartColors.axis, fontSize: 10 }} />
              <ReferenceArea y1={formMin} y2={-30} fill="rgb(var(--danger-500))" fillOpacity={0.06} ifOverflow="hidden"
                label={{ value: 'Overreaching', position: 'insideBottomLeft', fill: chartColors.axis, fontSize: 10 }} />
              <CartesianGrid vertical={false} stroke={chartColors.grid} strokeDasharray="3 3" />
              {xAxis}
              <YAxis width={40} domain={[formMin, formMax]} ticks={formTicks} {...axisProps} />
              <ReferenceLine y={0} stroke={chartColors.axis} strokeWidth={1} />
              <Tooltip content={<DayTooltip />} cursor={{ stroke: chartColors.axis, strokeDasharray: '3 3' }} />
              <Line type="monotone" dataKey="form" stroke={chartColors.primary} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/** "12 sessions from heart rate, 3 from RPE, 1 estimated" and what was assumed. */
function SourcesNote({ data }) {
  const { sources = {} } = data;
  const parts = [
    sources.hr_detail + sources.hr_average > 0 && `${sources.hr_detail + sources.hr_average} from heart rate`,
    sources.rpe > 0 && `${sources.rpe} from set RPE`,
    sources.estimate > 0 && `${sources.estimate} estimated from duration`,
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <p className="mt-4 text-xs text-gray-500">
      Sessions in this range: {parts.join(', ')}.
      {sources.rpe > 0 && (data.calibration?.sessions
        ? ` RPE is scaled to heart rate load using ${data.calibration.sessions} lifting sessions that have both.`
        : ' RPE uses a standard scale until a few lifting sessions have both heart rate and RPE.')}
      {data.assumed_resting_hr && ' Resting heart rate isn’t set, so 60 bpm is assumed.'}
    </p>
  );
}

/**
 * Today's fitness, fatigue and form, then the curves. `data` comes from
 * cardioAPI.getLoad(). Used on the Dashboard and in Analytics.
 */
export function FitnessFormPanel({ data, title = 'Fitness & form' }) {
  if (data.needs_thresholds) {
    return (
      <EmptyState
        icon={Gauge}
        title="Set your heart rate zones first"
        description="Training load is worked out from heart rate, so it needs your max (and ideally resting) heart rate."
        action={<Button to="/profile#heart-rate">Set heart rate zones</Button>}
      />
    );
  }
  if (!data.today || data.daily.every((d) => d.fitness === 0)) {
    return <EmptyState icon={Gauge} title="No training in this range" description="Log or sync some sessions to see your fitness and form." />;
  }

  const { today } = data;
  const status = FORM_STATUS[today.status];
  const spike = today.ratio >= SPIKE_RATIO && today.fitness >= MIN_FITNESS_FOR_SPIKE;
  const tiles = [
    { label: 'Fitness', value: formatNumber(today.fitness), icon: TrendingUp, color: FITNESS },
    { label: 'Fatigue', value: formatNumber(today.fatigue), icon: BatteryMedium, color: FATIGUE },
    { label: 'Form', value: `${today.form > 0 ? '+' : ''}${formatNumber(today.form)}`, icon: Gauge },
  ];

  return (
    <Card>
      <CardHeader title={title} subtitle={status.text} icon={Gauge} action={<Badge tone={status.tone}>{status.label}</Badge>} />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-gray-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              {t.color && <span className="h-0.5 w-3 rounded" style={{ background: t.color }} aria-hidden="true" />}
              {t.label}
            </p>
            <p className="tabular text-xl font-bold text-gray-900 sm:text-2xl">{t.value}</p>
          </div>
        ))}
      </div>
      {spike && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-warning-50 px-3 py-2 text-sm text-warning-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Your load this past week is {today.ratio}× your usual. Sharp jumps raise injury risk; ease in if it wasn&apos;t planned.
        </p>
      )}
      <Curves daily={data.daily} />
      <SourcesNote data={data} />
    </Card>
  );
}

/** Weekly load, lifting and cardio stacked. */
export function WeeklyLoadChart({ weekly }) {
  const series = [
    { key: 'strength', label: 'Lifting', color: 'var(--activity-strength)' },
    { key: 'cardio', label: 'Cardio', color: 'var(--activity-run)' },
  ];
  return (
    <Card>
      <CardHeader title="Weekly load" subtitle="Lifting and cardio, in heart-rate load units" icon={TrendingUp} />
      <ul className="mb-3 flex gap-4 text-xs text-gray-600" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />{s.label}
          </li>
        ))}
      </ul>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekly} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={chartColors.grid} strokeDasharray="3 3" />
            <XAxis dataKey="weekStart" tickFormatter={(v) => formatDate(v)} interval="preserveStartEnd" minTickGap={16} {...axisProps} />
            <YAxis width={44} {...axisProps} />
            <Tooltip
              cursor={{ fill: 'rgb(var(--gray-100))', radius: 8 }}
              content={({ active, payload }) => (active && payload?.length ? (
                <div className="rounded-xl border border-gray-200 bg-surface px-3 py-2 text-xs shadow-lift">
                  <p className="font-semibold text-gray-900">Week of {formatDate(payload[0].payload.weekStart)}</p>
                  {series.map((s) => (
                    <p key={s.key} className="tabular flex items-center gap-2 text-gray-600">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                      {s.label}<span className="ml-auto text-gray-900">{payload[0].payload[s.key]}</span>
                    </p>
                  ))}
                </div>
              ) : null)}
            />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} stackId="load" fill={s.color} stroke={chartColors.surface} strokeWidth={2} maxBarSize={28} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Loads the training load for `weeks` weeks. Returns { data, error }. */
function useTrainingLoad(weeks) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setError('');
    cardioAPI.getLoad(weeks)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load training load'); });
    return () => { cancelled = true; };
  }, [weeks]);
  return { data, error };
}

/** The Dashboard's "Fitness & form" insight. */
export function FitnessFormWidget({ weeks = 12 }) {
  const { data, error } = useTrainingLoad(weeks);
  if (error) return <EmptyState tone="error" title="Couldn't load training load" description={error} />;
  if (!data) return <Skeleton className="h-96 rounded-2xl" />;
  return <FitnessFormPanel data={data} />;
}

/** Analytics > Training load: the panel, weekly load and how it's worked out. */
export function TrainingLoadView({ weeks }) {
  const { data, error } = useTrainingLoad(weeks);
  if (error) return <EmptyState tone="error" title="Couldn't load training load" description={error} />;
  if (!data) return <Skeleton className="h-96 rounded-2xl" />;
  return (
    <div className="space-y-6">
      <FitnessFormPanel data={data} title="Fitness, fatigue & form" />
      {!data.needs_thresholds && data.weekly && <WeeklyLoadChart weekly={data.weekly} />}
      {!data.needs_thresholds && (
        <Card>
          <CardHeader title="How it's worked out" />
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-gray-600">
            <li><b className="font-medium text-gray-800">Load</b> per session is heart-rate based (TRIMP): minutes weighted by how close each heartbeat was to your max. Sessions without heart rate use set RPE × minutes, scaled to match, or failing that an estimate from their length.</li>
            <li><b className="font-medium text-gray-800">Fitness</b> is your load averaged over about six weeks; it rises slowly with consistent training.</li>
            <li><b className="font-medium text-gray-800">Fatigue</b> is the same over about a week; it rises and falls quickly.</li>
            <li><b className="font-medium text-gray-800">Form</b> is fitness minus fatigue at the start of the day. Around −10 to −30 is productive training; above +5 you&apos;re fresh; below −30 fatigue is building faster than you&apos;re adapting.</li>
          </ul>
        </Card>
      )}
    </div>
  );
}
