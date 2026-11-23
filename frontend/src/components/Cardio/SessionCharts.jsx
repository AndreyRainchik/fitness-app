import React, { useMemo } from 'react';
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Activity } from 'lucide-react';
import { Card, CardHeader } from '../ui';
import { chartColors } from '../../utils/format';
import {
  elevationUnit, formatClock, metersTo, metersToElevation, sportInfo,
} from '../../utils/cardio';

// Slower than this (m/s) is standing still: no pace is drawn there
const MIN_SPEED = 0.5;

function xLabel(x, byDistance, unit) {
  return byDistance ? `${x.toFixed(2)} ${unit}` : formatClock(x * 60);
}

function ChartTooltip({ active, payload, byDistance, unit, format }) {
  if (!active || !payload?.length || payload[0].value === null || payload[0].value === undefined) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-surface px-3 py-2 text-xs shadow-lift">
      <p className="tabular font-semibold text-gray-900">{format(payload[0].value)}</p>
      <p className="tabular text-gray-500">{xLabel(payload[0].payload.x, byDistance, unit)}</p>
    </div>
  );
}

/** One small chart of a single series against the shared x axis. */
function SeriesChart({ title, data, dataKey, format, tickFormat, reversed = false, area = false, byDistance, unit, domain }) {
  const Chart = area ? AreaChart : LineChart;
  const color = chartColors.primary;
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-gray-700">{title}</p>
      <div className="h-36 sm:h-40">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} syncId="session" margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={chartColors.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(x) => (byDistance ? x.toFixed(x >= 10 ? 0 : 1) : formatClock(x * 60))}
              tick={{ fill: chartColors.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              reversed={reversed}
              domain={domain ?? ['auto', 'auto']}
              tickFormatter={tickFormat ?? format}
              tick={{ fill: chartColors.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              content={<ChartTooltip byDistance={byDistance} unit={unit} format={format} />}
              cursor={{ stroke: chartColors.axis, strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            {area ? (
              <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={color} fillOpacity={0.12} isAnimationActive={false} connectNulls />
            ) : (
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Heart rate, pace (or speed) and elevation through the session, hover synced
 * across the charts. `series` comes from the analysis endpoint.
 */
function SessionCharts({ series, sport, environment, unit }) {
  const info = sportInfo(sport);
  const byDistance = info.hasDistance && series.some((p) => p.d > 0);
  const showPace = info.hasDistance && series.some((p) => p.v > MIN_SPEED);
  const showElevation = environment === 'outdoor' && series.some((p) => Number.isFinite(p.alt));

  const data = useMemo(() => series.map((p) => {
    const moving = p.v > MIN_SPEED;
    let pace = null;
    if (moving && info.metric === 'pace') pace = 1 / metersTo(p.v, unit); // s per km/mi
    else if (moving && info.metric === 'pace500') pace = 500 / p.v;
    return {
      x: byDistance ? metersTo(p.d || 0, unit) : p.t / 60,
      hr: p.hr ?? null,
      pace,
      speed: moving && info.metric === 'speed' ? metersTo(p.v, unit) * 3600 : null,
      alt: Number.isFinite(p.alt) ? metersToElevation(p.alt, unit) : null,
    };
  }), [series, byDistance, info.metric, unit]);

  // Keep the pace axis to the paces actually run (not a stop-start crawl)
  const paceDomain = useMemo(() => {
    const paces = data.map((d) => d.pace).filter((p) => p > 0).sort((a, b) => a - b);
    if (paces.length < 5) return undefined;
    const lo = paces[Math.floor(paces.length * 0.02)];
    const hi = paces[Math.floor(paces.length * 0.98)];
    return [Math.floor(lo / 15) * 15, Math.ceil(hi / 15) * 15];
  }, [data]);

  const hasHr = data.some((d) => d.hr);
  if (!hasHr && !showPace && !showElevation) return null;
  const paceUnit = info.metric === 'pace500' ? '/500m' : `/${unit}`;

  return (
    <Card>
      <CardHeader title="Through the session" subtitle={byDistance ? `By distance (${unit})` : 'By time'} icon={Activity} />
      <div className="space-y-5">
        {hasHr && <SeriesChart title="Heart rate" data={data} dataKey="hr" format={(v) => `${Math.round(v)} bpm`} tickFormat={(v) => Math.round(v)} byDistance={byDistance} unit={unit} />}
        {showPace && (info.metric === 'speed' ? (
          <SeriesChart title="Speed" data={data} dataKey="speed" format={(v) => `${v.toFixed(1)} ${unit === 'mi' ? 'mph' : 'km/h'}`} tickFormat={(v) => v.toFixed(0)} byDistance={byDistance} unit={unit} />
        ) : (
          <SeriesChart title="Pace" data={data} dataKey="pace" reversed domain={paceDomain} format={(v) => `${formatClock(v)} ${paceUnit}`} tickFormat={(v) => formatClock(v)} byDistance={byDistance} unit={unit} />
        ))}
        {showElevation && <SeriesChart title="Elevation" area data={data} dataKey="alt" format={(v) => `${Math.round(v)} ${elevationUnit(unit)}`} tickFormat={(v) => Math.round(v)} byDistance={byDistance} unit={unit} />}
      </div>
    </Card>
  );
}

export default SessionCharts;
