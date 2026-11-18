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
      <div className="scrollbar-none overflow-x-auto">
        <div className="inline-flex flex-col gap-1.5">
          <div className="ml-8 flex gap-[3px] text-[10px] text-gray-400">
            {columns.map((_, i) => {
              const label = months.find((m) => m.index === i);
              return (
                <span key={i} className="w-3.5 overflow-visible whitespace-nowrap sm:w-4">
                  {label?.label ?? ''}
                </span>
              );
            })}
          </div>
          <div className="flex gap-[3px]">
            <div className="mr-1 flex w-7 flex-col gap-[3px] text-[10px] text-gray-400">
              {DAY_LABELS.map((d, i) => (
                <span key={i} className="flex h-3.5 items-center sm:h-4">{d}</span>
              ))}
            </div>
            {columns.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.map((cell) => (
                  <span
                    key={cell.date}
                    className={`h-3.5 w-3.5 rounded-[4px] sm:h-4 sm:w-4 ${cellClass(cell)}`}
                    title={cell.future ? undefined : `${formatDate(cell.date, { weekday: 'short', month: 'short', day: 'numeric' })}: ${cell.count} workout${cell.count === 1 ? '' : 's'}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
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
