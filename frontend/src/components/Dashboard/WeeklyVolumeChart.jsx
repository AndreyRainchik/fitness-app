import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartColors, formatCompact, formatDate, formatNumber } from '../../utils/format';

function VolumeTooltip({ active, payload, units }) {
  if (!active || !payload?.length) return null;
  const week = payload[0].payload;
  return (
    <div className="rounded-xl border border-gray-200 bg-surface px-3 py-2 text-xs shadow-lift">
      <p className="font-semibold text-gray-900">Week of {formatDate(week.weekStart)}</p>
      <p className="tabular mt-0.5 text-gray-600">{formatNumber(week.volume)} {units}</p>
      <p className="text-gray-500">{week.workouts} workout{week.workouts === 1 ? '' : 's'} · {week.sets} sets</p>
    </div>
  );
}

/** Bar chart of working-set volume per week. `data` is dashboard-summary.weeklyVolume. */
function WeeklyVolumeChart({ data = [], units = 'lbs' }) {
  const lastIndex = data.length - 1;
  return (
    <div className="h-56 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
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
            tickFormatter={formatCompact}
            tick={{ fill: chartColors.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<VolumeTooltip units={units} />} cursor={{ fill: 'rgb(var(--gray-100))', radius: 8 }} />
          <Bar
            dataKey="volume"
            radius={[6, 6, 2, 2]}
            maxBarSize={28}
            shape={(props) => {
              const { x, y, width, height, index } = props;
              const fill = index === lastIndex ? chartColors.primary : chartColors.primarySoft;
              const r = Math.min(6, width / 2, height);
              if (!height || height <= 0) return null;
              return (
                <path
                  d={`M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`}
                  fill={fill}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default WeeklyVolumeChart;
