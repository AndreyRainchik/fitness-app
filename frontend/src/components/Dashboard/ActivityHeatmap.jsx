import React, { useMemo } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { formatDate } from '../../utils/format';

const WEEKS = 18;
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const toDay = (str) => Date.parse(`${str}T00:00:00Z`);
const toStr = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * GitHub-style calendar of training days for the last 18 weeks.
 * `activity` is [{ date: 'YYYY-MM-DD', count }].
 */
function ActivityHeatmap({ activity = [] }) {
  const { columns, months, total } = useMemo(() => {
    const counts = new Map(activity.map((a) => [a.date, a.count]));
    const today = toDay(getLocalDateString());
    const weekStart = today - new Date(today).getUTCDay() * 86400000;
    const first = weekStart - (WEEKS - 1) * 7 * 86400000;
    const cols = [];
    const monthLabels = [];
    let lastMonth = -1;
    for (let w = 0; w < WEEKS; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const ms = first + (w * 7 + d) * 86400000;
        const date = toStr(ms);
        col.push({ date, count: counts.get(date) ?? 0, future: ms > today });
      }
      const month = new Date(first + w * 7 * 86400000).getUTCMonth();
      if (month !== lastMonth) {
        monthLabels.push({ index: w, label: formatDate(col[0].date, { month: 'short' }) });
        lastMonth = month;
      }
      cols.push(col);
    }
    return { columns: cols, months: monthLabels, total: activity.reduce((s, a) => s + a.count, 0) };
  }, [activity]);

  const cellClass = (cell) => {
    if (cell.future) return 'bg-transparent';
    if (cell.count === 0) return 'bg-gray-100';
    if (cell.count === 1) return 'bg-primary-400';
    return 'bg-primary-600';
  };

  return (
    <div>
      {/* Fluid grid: cells shrink to fit any card width, no sideways scrolling */}
      <div
        className="grid max-w-xl gap-[3px] sm:gap-1"
        style={{ gridTemplateColumns: `1.75rem repeat(${WEEKS}, minmax(0, 1fr))` }}
      >
        <span />
        {columns.map((_, i) => {
          const label = months.find((m) => m.index === i);
          return (
            <span key={`m${i}`} className="overflow-visible whitespace-nowrap text-[10px] leading-4 text-gray-400">
              {label?.label ?? ''}
            </span>
          );
        })}
        {DAY_LABELS.map((dayLabel, d) => (
          <React.Fragment key={`r${d}`}>
            <span className="flex items-center text-[10px] leading-none text-gray-400">{dayLabel}</span>
            {columns.map((col) => {
              const cell = col[d];
              return (
                <span
                  key={cell.date}
                  className={`aspect-square w-full rounded-[3px] sm:rounded-[4px] ${cellClass(cell)}`}
                  title={cell.future ? undefined : `${formatDate(cell.date, { weekday: 'short', month: 'short', day: 'numeric' })}: ${cell.count} workout${cell.count === 1 ? '' : 's'}`}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>{total} workouts in the last {WEEKS} weeks</span>
        <span className="flex items-center gap-1">
          Less
          <span className="h-3 w-3 rounded-[3px] bg-gray-100" />
          <span className="h-3 w-3 rounded-[3px] bg-primary-400" />
          <span className="h-3 w-3 rounded-[3px] bg-primary-600" />
          More
        </span>
      </div>
    </div>
  );
}

export default ActivityHeatmap;
