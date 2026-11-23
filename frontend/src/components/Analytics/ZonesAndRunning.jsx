import React from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HeartPulse, Timer, Trophy } from 'lucide-react';
import { Button, Card, CardHeader } from '../ui';
import { chartColors, formatDate } from '../../utils/format';
import { formatClock, formatDuration, formatPaceOrSpeed } from '../../utils/cardio';
import { ZONE_COLORS } from '../Cardio/ZoneBreakdown';

const ZONE_KEYS = ['z1', 'z2', 'z3', 'z4', 'z5'];

function ZoneWeekTooltip({ active, payload, zones }) {
  if (!active || !payload?.length) return null;
  const week = payload[0].payload;
  const total = ZONE_KEYS.reduce((sum, k) => sum + week[k], 0);
  return (
    <div className="rounded-xl border border-gray-200 bg-surface px-3 py-2 text-xs shadow-lift">
      <p className="font-semibold text-gray-900">Week of {formatDate(week.weekStart)}</p>
      <p className="tabular mb-1 text-gray-600">{formatDuration(total * 60)} with heart rate</p>
      {[...ZONE_KEYS].reverse().filter((k) => week[k] > 0).map((k) => {
        const i = ZONE_KEYS.indexOf(k);
        return (
          <p key={k} className="tabular flex items-center gap-2 text-gray-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ZONE_COLORS[i] }} aria-hidden="true" />
            <span className="flex-1">Z{i + 1} {zones?.[i]?.name}</span>
            <span className="text-gray-900">{formatDuration(week[k] * 60)}</span>
          </p>
        );
      })}
    </div>
  );
}

/**
 * Weekly time in heart rate zones (strength and cardio), with the range's
 * totals per zone as a table. `data` comes from cardioAPI.getZones().
 */
export function ZonesCard({ data }) {
  if (!data) return null;
  if (!data.has_thresholds) {
    return (
      <Card>
        <CardHeader title="Time in heart rate zones" icon={HeartPulse} />
        <p className="mb-4 text-sm text-gray-600">Set your max heart rate to see how your training splits between easy and hard.</p>
        <Button variant="secondary" size="sm" to="/profile#heart-rate">Set heart rate zones</Button>
      </Card>
    );
  }

  const total = data.totals.reduce((a, b) => a + b, 0);
  const easy = total ? Math.round(((data.totals[0] + data.totals[1]) / total) * 100) : 0;
  return (
    <Card>
      <CardHeader
        title="Time in heart rate zones"
        subtitle={total ? `${easy}% easy (zones 1–2) · ${data.sessions_counted} sessions with heart rate` : 'No sessions with second-by-second heart rate in this range yet'}
        icon={HeartPulse}
      />
      {total > 0 && (
        <>
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-600" aria-label="Legend">
            {data.zones.map((z, i) => (
              <li key={z.zone} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ZONE_COLORS[i] }} aria-hidden="true" />
                Z{z.zone} {z.name}
              </li>
            ))}
          </ul>
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekly} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={chartColors.grid} strokeDasharray="3 3" />
                <XAxis dataKey="weekStart" tickFormatter={(v) => formatDate(v)} tick={{ fill: chartColors.axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tickFormatter={(v) => `${Math.round((v / 60) * 10) / 10}h`} tick={{ fill: chartColors.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<ZoneWeekTooltip zones={data.zones} />} cursor={{ fill: 'rgb(var(--gray-100))', radius: 8 }} />
                {ZONE_KEYS.map((k, i) => (
                  <Bar key={k} dataKey={k} stackId="zones" fill={ZONE_COLORS[i]} stroke={chartColors.surface} strokeWidth={2} maxBarSize={28} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="py-1.5 text-left font-medium">Zone</th>
                <th className="py-1.5 text-right font-medium">Cardio</th>
                <th className="py-1.5 text-right font-medium">Lifting</th>
                <th className="py-1.5 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-gray-100 text-gray-700">
              {data.zones.map((z, i) => (
                <tr key={z.zone}>
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ZONE_COLORS[i] }} aria-hidden="true" />
                      Z{z.zone} <span className="text-gray-500">{z.min}–{z.max}</span>
                    </span>
                  </td>
                  <td className="py-1.5 text-right">{formatDuration(data.by_kind.cardio[i])}</td>
                  <td className="py-1.5 text-right">{formatDuration(data.by_kind.strength[i])}</td>
                  <td className="py-1.5 text-right">{Math.round((data.totals[i] / total) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {data.sessions_without_detail > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          {data.sessions_without_detail} session{data.sessions_without_detail === 1 ? ' has' : 's have'} only an average heart rate and {data.sessions_without_detail === 1 ? "isn't" : "aren't"} counted. Detailed data for older Strava sessions arrives a few at a time with each sync.
        </p>
      )}
    </Card>
  );
}

const effortLink = (effort, children) => (
  <Link to={`/workout/${effort.workout_id}`} className="hover:underline">{children}</Link>
);

/**
 * Running best efforts (all-time and in the range) and race predictions
 * from VDOT. `data` comes from cardioAPI.getRunning().
 */
export function RunningCard({ data, unit, weeks }) {
  const records = (data?.records || []).filter((r) => r.best);
  if (!records.length) return null;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card className="min-w-0 lg:col-span-3">
        <CardHeader title="Running records" subtitle="Fastest stretches within outdoor runs" icon={Trophy} />
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="px-2 py-2 font-medium">Distance</th>
                <th className="px-2 py-2 font-medium">All-time best</th>
                <th className="px-2 py-2 font-medium">Last {weeks} weeks</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-gray-100 text-gray-700">
              {records.map((r) => (
                <tr key={r.key}>
                  <td className="px-2 py-2 font-medium text-gray-900">{r.label}</td>
                  <td className="px-2 py-2">
                    {effortLink(r.best, <span className="font-semibold text-gray-900">{formatClock(r.best.seconds)}</span>)}
                    <span className="ml-2 text-xs text-gray-500">{formatDate(r.best.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </td>
                  <td className="px-2 py-2">
                    {r.recent ? (
                      <>
                        {effortLink(r.recent, formatClock(r.recent.seconds))}
                        <span className="ml-2 text-xs text-gray-500">{formatPaceOrSpeed('run', r.meters, r.recent.seconds, unit)}</span>
                      </>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="min-w-0 lg:col-span-2">
        <CardHeader
          title="Race predictions"
          subtitle={data.vdot
            ? `VDOT ${data.vdot.value}, from your ${data.vdot.effort.label} on ${formatDate(data.vdot.effort.date)}`
            : `Needs an outdoor run of a mile or more in the last ${weeks} weeks`}
          icon={Timer}
        />
        {data.predictions.length > 0 && (
          <>
            <ul className="divide-y divide-gray-100 text-sm">
              {data.predictions.map((p) => (
                <li key={p.key} className="flex items-center justify-between py-2">
                  <span className="font-medium text-gray-900">{p.label}</span>
                  <span className="tabular">
                    <span className="font-semibold text-gray-900">{formatClock(p.seconds)}</span>
                    <span className="ml-2 text-xs text-gray-500">{formatPaceOrSpeed('run', p.meters, p.seconds, unit)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              Jack Daniels&apos; VDOT formula, from your best effort in training. Longer races assume you&apos;ve trained for the distance.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
