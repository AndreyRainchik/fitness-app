import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ChevronRight, Clock, Download, Dumbbell, Plus, Search, Trash2, X } from 'lucide-react';
import { workoutsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout/Layout';
import {
  Alert, Button, Card, EmptyState, PageHeader, Skeleton, useConfirm, useToast,
} from '../components/ui';
import { formatCompact, formatDate, relativeDay } from '../utils/format';
import {
  SPORTS, SPORT_IDS, cardioSummaryLine, distanceUnit, formatDuration, sessionTitle, sportInfo,
} from '../utils/cardio';

const isCardio = (w) => w.kind === 'cardio';
const workoutTitle = (w) => w.name || (isCardio(w) ? sessionTitle(w.sport, w.environment) : 'Untitled workout');

function Workouts() {
  const { user } = useAuth();
  const units = user?.units || 'lbs';
  const unit = distanceUnit(units);
  const confirm = useConfirm();
  const toast = useToast();

  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'strength' | a cardio sport

  useEffect(() => {
    (async () => {
      try {
        const data = await workoutsAPI.getAll();
        setWorkouts(data.workouts || []);
      } catch (err) {
        setError(err.message || 'Failed to load workouts');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Filter chips: All, Strength, then each sport that has at least one session
  const filters = useMemo(() => {
    const sports = new Set(workouts.filter(isCardio).map((w) => w.sport));
    const chips = [{ id: 'all', label: 'All' }];
    if (workouts.some((w) => !isCardio(w))) chips.push({ id: 'strength', label: 'Strength', icon: Dumbbell });
    for (const sport of SPORT_IDS) {
      if (sports.has(sport)) chips.push({ id: sport, label: SPORTS[sport].label, icon: SPORTS[sport].icon });
    }
    return chips.length > 2 ? chips : [];
  }, [workouts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byType = filter === 'all' ? workouts
      : filter === 'strength' ? workouts.filter((w) => !isCardio(w))
        : workouts.filter((w) => isCardio(w) && w.sport === filter);
    if (!q) return byType;
    return byType.filter((w) =>
      workoutTitle(w).toLowerCase().includes(q)
      || (w.notes || '').toLowerCase().includes(q)
      || (w.exercises || []).some((e) => e.name.toLowerCase().includes(q)));
  }, [workouts, query, filter]);

  // Group by month, newest first
  const groups = useMemo(() => {
    const map = new Map();
    for (const w of filtered) {
      const key = String(w.date).slice(0, 7);
      if (!map.has(key)) map.set(key, { key, label: formatDate(`${key}-01`, { month: 'long', year: 'numeric' }), items: [], volume: 0, cardioSeconds: 0 });
      const g = map.get(key);
      g.items.push(w);
      g.volume += w.total_volume || 0;
      if (isCardio(w)) g.cardioSeconds += w.duration_s || 0;
    }
    return [...map.values()];
  }, [filtered]);

  const handleDeleteWorkout = async (workout) => {
    const confirmed = await confirm({
      title: isCardio(workout) ? 'Delete session?' : 'Delete workout?',
      message: `“${workoutTitle(workout)}” on ${formatDate(workout.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}${isCardio(workout) ? '' : ' and all its sets'} will be permanently deleted.`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!confirmed) return;

    try {
      await workoutsAPI.delete(workout.id);
      setWorkouts((list) => list.filter((w) => w.id !== workout.id));
      toast({ tone: 'success', message: 'Workout deleted' });
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't delete workout: ${err.message}` });
    }
  };

  return (
    <Layout width="max-w-4xl">
      <PageHeader
        title="History"
        subtitle={loading ? ' ' : `${workouts.length} session${workouts.length === 1 ? '' : 's'} logged`}
        actions={(
          <>
            <Button variant="secondary" to="/workout/new" icon={Plus}>Log past workout</Button>
            <Button variant="secondary" to="/cardio/new" icon={Activity}>Log cardio</Button>
            <Button variant="secondary" to="/import/hevy" icon={Download}>Import from Hevy</Button>
            <Button to="/workout/active" icon={Dumbbell} className="hidden sm:inline-flex">Start workout</Button>
          </>
        )}
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : workouts.length === 0 ? (
        !error && (
          <EmptyState
            icon={Dumbbell}
            title="No workouts yet"
            description="Start your first workout to see your progress here."
            action={<Button to="/workout/active" icon={Plus}>Start workout</Button>}
          />
        )
      ) : (
        <>
          <div className="relative mb-6">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, exercise or note"
              aria-label="Search workouts"
              className="h-11 w-full pl-10 pr-10 text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {filters.length > 0 && (
            <div className="scrollbar-none -mt-2 mb-6 flex gap-2 overflow-x-auto" role="group" aria-label="Filter by activity">
              {filters.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                  className={`inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
                    filter === id
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 bg-surface text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                  {label}
                </button>
              ))}
            </div>
          )}

          {groups.length === 0 ? (
            <EmptyState icon={Search} title="No matches" description={query ? `Nothing matches “${query}”.` : 'No sessions of this type yet.'} />
          ) : (
            <div className="space-y-8">
              {groups.map((group) => (
                <section key={group.key}>
                  <div className="mb-3 flex items-baseline justify-between px-1">
                    <h2 className="text-sm font-semibold text-gray-900">{group.label}</h2>
                    <p className="tabular text-xs text-gray-500">
                      {[
                        `${group.items.length} session${group.items.length === 1 ? '' : 's'}`,
                        group.volume > 0 ? `${formatCompact(group.volume)} ${units}` : null,
                        group.cardioSeconds > 0 ? `${formatDuration(group.cardioSeconds)} cardio` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Card padding="p-1.5">
                    <ul className="divide-y divide-gray-100">
                      {group.items.map((workout) => {
                        const cardio = isCardio(workout);
                        const SportIcon = cardio ? sportInfo(workout.sport).icon : null;
                        return (
                        <li key={workout.id} className="group relative">
                          <Link
                            to={`/workout/${workout.id}`}
                            className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-gray-50 active:bg-gray-100 sm:gap-4 sm:p-3 sm:pr-14"
                          >
                            <span className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-gray-100 leading-none">
                              <span className="text-[10px] font-semibold uppercase text-gray-500">{formatDate(workout.date, { weekday: 'short' })}</span>
                              <span className="tabular text-lg font-bold text-gray-900">{formatDate(workout.date, { day: 'numeric' })}</span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline gap-2">
                                {SportIcon && <SportIcon className="h-4 w-4 flex-shrink-0 self-center text-gray-400" aria-label={SPORTS[workout.sport]?.label} />}
                                <span className="truncate font-semibold text-gray-900">{workoutTitle(workout)}</span>
                                <span className="hidden flex-shrink-0 text-xs text-gray-400 sm:inline">{relativeDay(workout.date)}</span>
                              </span>
                              {cardio ? (
                                <span className="tabular mt-1 block truncate text-xs text-gray-500">
                                  {cardioSummaryLine(workout, unit) || sessionTitle(workout.sport, workout.environment)}
                                </span>
                              ) : (
                              <>
                              <span className="mt-1 block truncate text-xs text-gray-500 sm:hidden">
                                {(workout.exercises || []).map((ex) => ex.name).join(' · ') || 'No exercises'}
                              </span>
                              <span className="tabular mt-0.5 block text-xs text-gray-400 sm:hidden">
                                {[
                                  workout.total_volume > 0 ? `${formatCompact(workout.total_volume)} ${units}` : null,
                                  workout.duration_minutes > 0 ? `${workout.duration_minutes} min` : null,
                                ].filter(Boolean).join(' · ')}
                              </span>
                              <span className="mt-1 hidden flex-wrap gap-1 sm:flex">
                                {(workout.exercises || []).slice(0, 3).map((ex) => (
                                  <span key={ex.name} className="chip !py-0.5">{ex.name}</span>
                                ))}
                                {(workout.exercises?.length || 0) > 3 && (
                                  <span className="chip !py-0.5">+{workout.exercises.length - 3}</span>
                                )}
                              </span>
                              </>
                              )}
                            </span>
                            <span className="hidden flex-shrink-0 text-right sm:block">
                              {!cardio && workout.total_volume > 0 && (
                                <span className="tabular block text-sm font-semibold text-gray-900">
                                  {formatCompact(workout.total_volume)} <span className="font-normal text-gray-500">{units}</span>
                                </span>
                              )}
                              {workout.duration_minutes > 0 && (
                                <span className="tabular flex items-center justify-end gap-1 text-xs text-gray-500">
                                  <Clock className="h-3 w-3" /> {workout.duration_minutes} min
                                </span>
                              )}
                            </span>
                            <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300 sm:hidden" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDeleteWorkout(workout)}
                            className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-lg p-2 text-gray-300 transition-colors hover:bg-danger-50 hover:text-danger-600 sm:block sm:opacity-0 sm:focus:opacity-100 sm:group-hover:opacity-100"
                            aria-label={`Delete ${workout.name || 'workout'}`}
                            title="Delete workout"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                        );
                      })}
                    </ul>
                  </Card>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}

export default Workouts;
