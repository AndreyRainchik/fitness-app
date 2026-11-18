import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, CalendarCheck, ChevronRight, ClipboardList, Dumbbell, Flame, Play, Plus, Timer, TrendingUp, Trophy,
} from 'lucide-react';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../context/AuthContext';
import {
  Alert, Badge, Button, Card, CardHeader, EmptyState, Skeleton, StatTile, Tabs, useToast,
} from '../components/ui';
import { analyticsAPI, templatesAPI, workoutsAPI } from '../services/api';
import { useWorkoutDraft } from '../utils/workoutDraft';
import { formatCompact, formatDate, formatNumber, greeting, plural, relativeDay } from '../utils/format';
import { getLocalDateString } from '../utils/dateUtils';
import WilksProgressChart from '../components/Dashboard/WilksProgressChart';
import WeeklyVolumeChart from '../components/Dashboard/WeeklyVolumeChart';
import ActivityHeatmap from '../components/Dashboard/ActivityHeatmap';
import MuscleGroupHeatmap from '../components/Analytics/MuscleGroupHeatmap';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

function VolumeTrend({ current, previous }) {
  if (!previous) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return (
    <span className={pct >= 0 ? 'text-success-600' : 'text-gray-500'}>
      {pct >= 0 ? '+' : ''}{pct}% vs last week
    </span>
  );
}

/** Hero card: start / resume a workout, or pick a template. */
function StartCard({ draft, templates, onStartTemplate, startingId }) {
  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="relative bg-gradient-to-br from-primary-600 via-primary-600 to-purple-600 p-5 text-white sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">{draft ? 'You have a workout in progress' : 'Ready when you are'}</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              {draft ? draft.values?.name || 'Untitled workout' : 'Start a new session'}
            </h2>
          </div>
          <Link
            to="/workout/active"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-primary-700 shadow-sm transition-transform hover:bg-white/90 active:scale-[0.98]"
          >
            {draft ? <Play className="h-4 w-4" fill="currentColor" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
            {draft ? 'Resume workout' : 'Empty workout'}
          </Link>
        </div>
      </div>
      {!draft && templates.length > 0 && (
        <div className="p-4 sm:p-5">
          <p className="eyebrow mb-3">Start from a template</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {templates.slice(0, 3).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onStartTemplate(t.id)}
                disabled={startingId !== null}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50 disabled:opacity-60"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-primary-100 group-hover:text-primary-700">
                  {startingId === t.id
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    : <ClipboardList className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900">{t.name}</span>
                  <span className="block text-xs text-gray-500">{t.exercise_count} exercises · {t.total_sets} sets</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const units = user?.units || 'lbs';
  const navigate = useNavigate();
  const toast = useToast();
  const draft = useWorkoutDraft();
  const [data, setData] = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [insightTab, setInsightTab] = useState('strength');
  const [startingId, setStartingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [summary, workouts, templateList] = await Promise.all([
          analyticsAPI.getDashboardSummary(),
          workoutsAPI.getAll({ limit: 5 }),
          templatesAPI.getAll().catch(() => ({ templates: [] })),
        ]);
        if (cancelled) return;
        setData(summary);
        setRecentWorkouts(workouts.workouts || []);
        setTemplates(templateList.templates || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load dashboard data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const startTemplate = async (templateId) => {
    setStartingId(templateId);
    try {
      const res = await templatesAPI.getById(templateId);
      navigate('/workout/active', { state: { template: res.template, fromTemplate: true } });
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't load template: ${err.message}` });
      setStartingId(null);
    }
  };

  const today = formatDate(getLocalDateString(), { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Layout>
      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <header>
            <p className="eyebrow">{today}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {greeting()}, {user?.username || 'athlete'}
            </h1>
          </header>

          {error && <Alert>{error}</Alert>}

          <StartCard draft={draft} templates={templates} onStartTemplate={startTemplate} startingId={startingId} />

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile
              label="This week"
              value={data?.thisWeek ?? 0}
              unit={data?.thisWeek === 1 ? 'workout' : 'workouts'}
              hint={`Avg ${data?.summary?.averageWorkoutsPerWeek ?? 0} / week`}
              icon={CalendarCheck}
            />
            <StatTile
              label="Week streak"
              value={data?.weeklyStreak ?? 0}
              unit={data?.weeklyStreak === 1 ? 'week' : 'weeks'}
              hint={data?.streak > 1 ? `${data.streak} days in a row` : 'Weeks with a workout'}
              icon={Flame}
              tone="warning"
            />
            <StatTile
              label="Volume this week"
              value={formatCompact(data?.volumeThisWeek)}
              unit={units}
              hint={<VolumeTrend current={data?.volumeThisWeek} previous={data?.volumeLastWeek} />}
              icon={TrendingUp}
              tone="success"
            />
            <StatTile
              label="Total workouts"
              value={formatNumber(data?.totalWorkouts)}
              hint={data?.summary?.lastWorkoutDate ? `Last: ${relativeDay(data.summary.lastWorkoutDate)}` : 'All time'}
              icon={Dumbbell}
              tone="purple"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Weekly volume" subtitle={`Working sets, last ${data?.weeklyVolume?.length ?? 12} weeks`} icon={Activity} />
              <WeeklyVolumeChart data={data?.weeklyVolume ?? []} units={units} />
            </Card>

            <Card>
              <CardHeader title="Recent PRs" subtitle="Last 30 days" icon={Trophy} />
              {data?.recentPRs?.length ? (
                <ul className="space-y-2">
                  {data.recentPRs.slice(0, 5).map((pr) => (
                    <li key={`${pr.exerciseId}-${pr.date}`}>
                      <Link
                        to={pr.workoutId ? `/workout/${pr.workoutId}` : '/analytics'}
                        className="flex items-center gap-3 rounded-xl p-2 -mx-2 transition-colors hover:bg-gray-50"
                      >
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-600">
                          <Trophy className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-gray-900">{pr.exercise}</span>
                          <span className="tabular block text-xs text-gray-500">
                            {formatNumber(pr.weight, 1)} × {pr.reps} · e1RM {formatNumber(pr.estimated1RM, 1)} · {relativeDay(pr.date)}
                          </span>
                        </span>
                        {pr.firstTime && <Badge tone="primary">New</Badge>}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-gray-500">No new records this month — yet.</p>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader title="Consistency" subtitle="Training days" icon={CalendarCheck} />
            <ActivityHeatmap activity={data?.activity ?? []} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Recent workouts"
                icon={Timer}
                action={<Button variant="ghost" size="sm" to="/workouts">View all</Button>}
              />
              {recentWorkouts.length === 0 ? (
                <EmptyState
                  icon={Dumbbell}
                  title="No workouts yet"
                  description="Log your first session to see your progress here."
                  action={<Button to="/workout/active" icon={Plus}>Start workout</Button>}
                />
              ) : (
                <ul className="-mx-2 divide-y divide-gray-100">
                  {recentWorkouts.map((w) => (
                    <li key={w.id}>
                      <Link to={`/workout/${w.id}`} className="flex items-center gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-gray-50">
                        <span className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-gray-100 leading-none">
                          <span className="text-[10px] font-semibold uppercase text-gray-500">{formatDate(w.date, { month: 'short' })}</span>
                          <span className="tabular text-base font-bold text-gray-900">{formatDate(w.date, { day: 'numeric' })}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-gray-900">{w.name || 'Workout'}</span>
                          <span className="block truncate text-xs text-gray-500">
                            {[
                              plural(w.exercise_count || w.exercises?.length || 0, 'exercise'),
                              w.duration_minutes > 0 ? `${w.duration_minutes} min` : null,
                              w.total_volume > 0 ? `${formatCompact(w.total_volume)} ${units}` : null,
                            ].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Shortcuts" />
              <div className="grid gap-2">
                {[
                  { to: '/current-week', label: "This week's program", icon: CalendarCheck },
                  { to: '/templates', label: 'Templates', icon: ClipboardList },
                  { to: '/profile#bodyweight', label: 'Log bodyweight', icon: Activity },
                  { to: '/analytics', label: 'Strength analytics', icon: TrendingUp },
                ].map(({ to, label, icon: Icon }) => (
                  <Link key={to} to={to} className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50">
                    <Icon className="h-4 w-4 text-gray-400" />
                    <span className="flex-1">{label}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-gray-900">Insights</h2>
              <Tabs
                label="Insights"
                active={insightTab}
                onChange={setInsightTab}
                tabs={[
                  { id: 'strength', label: 'Strength trend' },
                  { id: 'muscles', label: 'Muscles this week' },
                ]}
              />
            </div>
            {insightTab === 'strength' ? <WilksProgressChart weeks={12} /> : <MuscleGroupHeatmap />}
          </section>
        </div>
      )}
    </Layout>
  );
}

export default Dashboard;
