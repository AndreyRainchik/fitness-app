import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { analyticsAPI } from '../../services/api';
import { localDateStringFromDate } from '../../utils/dateUtils';
import { Card, Spinner } from '../ui';
import BodyMap from './BodyMap';

const GROUPS = ['Chest', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Upper Back', 'Lower Back', 'Core', 'Glutes', 'Quadriceps', 'Hamstrings', 'Calves'];

const UNTRAINED = 'rgb(var(--gray-200))';
const SCALE = [0.25, 0.45, 0.65, 0.82, 1].map((a) => `rgb(var(--primary-500) / ${a})`);

const formatSets = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Weekly sets per muscle group on a front/back body map. */
function MuscleGroupHeatmap() {
  const [muscleData, setMuscleData] = useState([]);
  const [weekStart, setWeekStart] = useState(null);
  const [weekEnd, setWeekEnd] = useState(null);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await analyticsAPI.getMuscleGroupsWeekly(localDateStringFromDate(currentDate));
        if (cancelled) return;
        setMuscleData(data.muscleGroups || []);
        setWeekStart(data.weekStart);
        setWeekEnd(data.weekEnd);
      } catch (err) {
        console.error('Error fetching muscle data:', err);
        if (!cancelled) setError('Failed to load muscle group data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentDate]);

  const shiftWeek = (days) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + days);
    setCurrentDate(next);
  };

  const setsFor = (group) =>
    muscleData.find((m) => m.muscleGroup.toLowerCase() === group.toLowerCase())?.setCount ?? 0;
  const maxSets = Math.max(...muscleData.map((m) => m.setCount), 1);

  const fillFor = (group) => {
    const sets = setsFor(group);
    if (!sets) return UNTRAINED;
    const intensity = Math.min(sets / maxSets, 1);
    return SCALE[Math.min(SCALE.length - 1, Math.floor(intensity * SCALE.length - 0.0001))];
  };

  const formatRange = () => {
    if (!weekStart || !weekEnd) return '';
    const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
    return `${new Date(weekStart).toLocaleDateString('en-US', opts)} – ${new Date(weekEnd).toLocaleDateString('en-US', opts)}`;
  };

  const totalSets = muscleData.reduce((sum, m) => sum + m.setCount, 0);
  const ranked = GROUPS.map((g) => ({ group: g, sets: setsFor(g) })).sort((a, b) => b.sets - a.sets);
  const activeSets = active ? setsFor(active) : null;

  return (
    <Card>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-gray-900 sm:text-lg">Weekly muscle groups</h2>
          <p className="text-sm text-gray-500">{formatRange() || ' '}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shiftWeek(-7)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setCurrentDate(new Date())} className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50">
            This week
          </button>
          <button type="button" onClick={() => shiftWeek(7)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-danger-50 p-4 text-sm text-danger-800">{error}</p>
      ) : loading ? (
        <div className="flex h-80 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_15rem] lg:items-center">
          <div className="relative">
            <BodyMap fillFor={fillFor} active={active} onHover={setActive} />
            <div
              className={`pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-50 shadow-lift transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`}
              aria-live="polite"
            >
              {active && <>{active} · {formatSets(activeSets)} set{activeSets === 1 ? '' : 's'}</>}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="eyebrow">Sets by muscle</p>
              <p className="tabular text-xs text-gray-500">{formatSets(totalSets)} total</p>
            </div>
            <ul className="space-y-1">
              {ranked.map(({ group, sets }) => (
                <li key={group}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(group)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(group)}
                    onBlur={() => setActive(null)}
                    className={`flex min-h-[36px] w-full items-center gap-3 rounded-lg px-2 py-1 text-left text-sm transition-colors ${active === group ? 'bg-gray-100' : ''}`}
                  >
                    <span className={`w-24 flex-shrink-0 ${sets ? 'font-medium text-gray-800' : 'text-gray-400'}`}>{group}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <span className="block h-full rounded-full bg-primary-500" style={{ width: `${(sets / maxSets) * 100}%` }} />
                    </span>
                    <span className="tabular w-8 text-right text-xs text-gray-500">{sets ? formatSets(sets) : '–'}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] text-gray-500">
              <span>None</span>
              <span className="h-2.5 w-5 rounded-sm" style={{ background: UNTRAINED }} />
              {SCALE.map((c) => <span key={c} className="h-2.5 w-5 rounded-sm" style={{ background: c }} />)}
              <span>Most</span>
            </div>
            <p className="mt-2 text-[11px] text-gray-400">Secondary muscles count as half a set.</p>
          </div>
        </div>
      )}
    </Card>
  );
}

export default MuscleGroupHeatmap;
