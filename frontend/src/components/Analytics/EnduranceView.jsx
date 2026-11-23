import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Clock, HeartPulse, Plus } from 'lucide-react';
import { cardioAPI } from '../../services/api';
import { RunningCard, ZonesCard } from './ZonesAndRunning';
import { Button, Card, CardHeader, EmptyState, Skeleton, StatTile } from '../ui';
import { chartColors, formatDate, plural } from '../../utils/format';
import {
  ACTIVITY_TYPES, SPORTS, formatDistance, formatDuration, formatPaceOrSpeed, sportInfo,
} from '../../utils/cardio';

const minutesLabel = (minutes) => formatDuration(minutes * 60);

function WeekTooltip({ active, payload, types }) {
  if (!active || !payload?.length) return null;
  const week = payload[0].payload;
  const total = types.reduce((sum, t) => sum + (week[t.id] || 0), 0);
  return (
    <div className="rounded-xl border border-gray-200 bg-surface px-3 py-2 text-xs shadow-lift">
      <p className="font-semibold text-gray-900">Week of {formatDate(week.weekStart)}</p>
      <p className="tabular mb-1 text-gray-600">{minutesLabel(total)} total</p>
      {[...types].reverse().filter((t) => week[t.id] > 0).map((t) => (
        <p key={t.id} className="tabular flex items-center gap-2 text-gray-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} aria-hidden="true" />
          <span className="flex-1">{t.label}</span>
          <span className="text-gray-900">{minutesLabel(week[t.id])}</span>
        </p>
      ))}
    </div>
  );
}

/** Stacked weekly minutes by activity type. */
function WeeklyTimeChart({ weekly }) {
  // Only types with time in the range, keeping the fixed order (and colors)
  const types = ACTIVITY_TYPES.filter((t) => weekly.some((w) => w[t.id] > 0));
  return (
    <>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-600" aria-label="Legend">
        {types.map((t) => (
          <li key={t.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} aria-hidden="true" />
            {t.label}
          </li>
        ))}
      </ul>
      <div className="h-60 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekly} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={chartColors.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="weekStart"
              tickFormatter={(v) => formatDate(v)}
              tick={{ fill: chartColors.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 60 * 10) / 10}h`}
              tick={{ fill: chartColors.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip content={<WeekTooltip types={types} />} cursor={{ fill: 'rgb(var(--gray-100))', radius: 8 }} />
            {types.map((t) => (
              <Bar
                key={t.id}
                dataKey={t.id}
                name={t.label}
                stackId="time"
                fill={t.color}
                stroke={chartColors.surface}
                strokeWidth={2}
                maxBarSize={28}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/** Per-sport totals over the range (also the table view of the chart). */
function SportTable({ sports, unit }) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[600px] whitespace-nowrap text-left text-sm">
        <thead>
          <tr className="text-xs text-gray-500">
            <th className="px-2 py-2 font-medium">Activity</th>
            <th className="px-2 py-2 text-right font-medium">Sessions</th>
            <th className="px-2 py-2 text-right font-medium">Time</th>
            <th className="px-2 py-2 text-right font-medium">Distance</th>
            <th className="px-2 py-2 text-right font-medium">Avg pace / speed</th>
            <th className="px-2 py-2 text-right font-medium">Avg HR</th>
            <th className="px-2 py-2 text-right font-medium">Longest</th>
          </tr>
        </thead>
        <tbody className="tabular divide-y divide-gray-100">
          {sports.map((s) => {
            const info = sportInfo(s.sport);
            const Icon = info.icon;
            const split = [s.outdoor && `${s.outdoor} outdoor`, s.indoor && `${s.indoor} indoor`].filter(Boolean).join(', ');
            return (
              <tr key={s.sport} className="text-gray-700">
                <td className="px-2 py-2.5">
                  <span className="flex items-center gap-2 font-medium text-gray-900">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: `var(--activity-${s.sport})` }} aria-hidden="true" />
                    <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    {info.label}
                  </span>
                  {split && s.sport !== 'boulder' && <span className="ml-[3.25rem] block text-xs text-gray-500">{split}</span>}
                </td>
                <td className="px-2 py-2.5 text-right">{s.sessions}</td>
                <td className="px-2 py-2.5 text-right">{formatDuration(s.duration_s)}</td>
                <td className="px-2 py-2.5 text-right">{info.hasDistance ? formatDistance(s.distance_m, unit, 1) ?? '—' : '—'}</td>
                <td className="px-2 py-2.5 text-right">{formatPaceOrSpeed(s.sport, s.distance_m, s.distance_duration_s, unit) ?? '—'}</td>
                <td className="px-2 py-2.5 text-right">{s.avg_hr ? `${s.avg_hr} bpm` : '—'}</td>
                <td className="px-2 py-2.5 text-right">
                  {info.hasDistance && s.longest_distance_m > 0
                    ? formatDistance(s.longest_distance_m, unit, 1)
                    : formatDuration(s.longest_duration_s)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Endurance tab: this week's training, weekly time by activity type
 * (strength included), and per-sport totals over the selected range.
 */
function EnduranceView({ weeks, unit }) {
  const [data, setData] = useState(null);
  const [zones, setZones] = useState(null);
  const [running, setRunning] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    cardioAPI.getSummary(weeks)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load endurance data'); });
    // Extras: the page still works without them
    cardioAPI.getZones(weeks).then((result) => { if (!cancelled) setZones(result); }).catch(() => {});
    cardioAPI.getRunning(weeks).then((result) => { if (!cancelled) setRunning(result); }).catch(() => {});
    return () => { cancelled = true; };
  }, [weeks]);

  if (error) {
    return <EmptyState tone="error" title="Couldn't load endurance data" description={error} />;
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (data.totals.cardio_sessions === 0) {
    return (
      <EmptyState
        icon={HeartPulse}
        title="No cardio in this range"
        description="Log a run, ride, row or climbing session to see your endurance training here."
        action={<Button to="/cardio/new" icon={Plus}>Log cardio</Button>}
      />
    );
  }

  const week = data.thisWeek;
  const cardioThisWeek = Object.entries(week.byType).filter(([type]) => type !== 'strength');
  const cardioSecondsThisWeek = cardioThisWeek.reduce((sum, [, v]) => sum + v.duration_s, 0);
  const cardioSessionsThisWeek = cardioThisWeek.reduce((sum, [, v]) => sum + v.sessions, 0);
  const run = week.byType.run;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile
          label="Training this week"
          value={formatDuration(week.duration_s)}
          hint={plural(week.sessions, 'session')}
          icon={Clock}
        />
        <StatTile
          label="Cardio this week"
          value={formatDuration(cardioSecondsThisWeek)}
          hint={plural(cardioSessionsThisWeek, 'session')}
          icon={HeartPulse}
          tone="danger"
        />
        <StatTile
          label="Running this week"
          value={run?.distance_m > 0 ? formatDistance(run.distance_m, unit, 1) : run ? formatDuration(run.duration_s) : '—'}
          hint={run ? plural(run.sessions, SPORTS.run.noun) : 'No runs yet'}
          icon={Activity}
          tone="warning"
        />
      </div>

      <Card>
        <CardHeader title="Weekly training time" subtitle="Strength and cardio, by activity" icon={Clock} />
        <WeeklyTimeChart weekly={data.weekly} />
      </Card>

      <Card>
        <CardHeader
          title="By activity"
          subtitle={`Last ${data.weeks} weeks · ${plural(data.totals.cardio_sessions, 'cardio session')} · ${formatDuration(data.totals.cardio_duration_s)}`}
          icon={HeartPulse}
        />
        <SportTable sports={data.sports} unit={unit} />
      </Card>

      <ZonesCard data={zones} />
      <RunningCard data={running} unit={unit} weeks={data.weeks} />
    </div>
  );
}

export default EnduranceView;
