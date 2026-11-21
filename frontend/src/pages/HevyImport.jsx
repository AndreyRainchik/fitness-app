import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, RefreshCw, TriangleAlert,
} from 'lucide-react';
import { exercisesAPI, hevyAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import HevyConnectionCard from '../components/Hevy/HevyConnectionCard';
import {
  Alert, Badge, Button, Card, EmptyState, Field, Input, LoadingState, PageHeader, Select, Skeleton, Tabs, useToast,
} from '../components/ui';
import { formatTimestamp, plural } from '../utils/format';

const MAX_SELECTED = 50;

const CATEGORIES = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other'];
const MUSCLE_GROUPS = ['Back', 'Biceps', 'Calves', 'Chest', 'Core', 'Forearms', 'Glutes', 'Hamstrings', 'Quadriceps', 'Shoulders', 'Triceps', 'Other'];

const STATUS_BADGES = {
  imported: { tone: 'success', label: 'Imported' },
  changed: { tone: 'warning', label: 'Changed in Hevy' },
};

/** "Tue, Nov 18 · 6:30 PM" in the user's timezone */
function formatWorkoutTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  });
  return `${day} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

// ---------------------------------------------------------------------------
// Step 1: choose workouts
// ---------------------------------------------------------------------------

function WorkoutRow({ workout, checked, disabled, onToggle }) {
  const badge = STATUS_BADGES[workout.status];
  return (
    <li>
      <label
        className={`flex items-start gap-3 rounded-xl p-3 transition-colors ${
          checked ? 'bg-primary-50/70' : 'hover:bg-gray-50'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 flex-shrink-0"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          aria-label={`Select ${workout.title}`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold text-gray-900">{workout.title}</span>
            {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
          </span>
          <span className="tabular mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
            <span>{formatWorkoutTime(workout.start_time)}</span>
            {workout.duration_minutes && (
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{workout.duration_minutes} min</span>
            )}
            <span>{plural(workout.set_count, 'set')}</span>
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1">
            {workout.exercises.slice(0, 4).map((ex, i) => (
              <span key={`${ex.title}-${i}`} className="chip !py-0.5">{ex.title}</span>
            ))}
            {workout.exercises.length > 4 && <span className="chip !py-0.5">+{workout.exercises.length - 4}</span>}
          </span>
        </span>
        {workout.local_workout_id && (
          <Link
            to={`/workout/${workout.local_workout_id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 self-center rounded-lg px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
          >
            View
          </Link>
        )}
      </label>
    </li>
  );
}

function WorkoutPicker({ status, view, setView, selected, setSelected, onReview }) {
  const { page } = view;
  // "New since last import" needs an earlier import
  const mode = view.mode === 'new' && status.last_synced_at ? 'new' : 'all';
  const setPage = (update) => setView((v) => ({ ...v, page: typeof update === 'function' ? update(v.page) : update }));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await hevyAPI.listWorkouts(page, mode));
    } catch (err) {
      setError(err.message || 'Could not load your Hevy workouts');
    } finally {
      setLoading(false);
    }
  }, [page, mode]);

  useEffect(() => { load(); }, [load]);

  const workouts = data?.workouts ?? [];
  const pageCount = Math.max(1, data?.page_count ?? 1);
  const full = selected.size >= MAX_SELECTED;

  const toggle = (workout) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(workout.id)) next.delete(workout.id);
      else if (next.size < MAX_SELECTED) next.set(workout.id, workout);
      return next;
    });
  };

  // Everything on this page that hasn't been imported, or changed since
  const selectable = workouts.filter((w) => w.status !== 'imported');
  const allSelectableChosen = selectable.length > 0 && selectable.every((w) => selected.has(w.id));
  const toggleNewOnPage = () => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allSelectableChosen) selectable.forEach((w) => next.delete(w.id));
      else selectable.forEach((w) => { if (next.size < MAX_SELECTED) next.set(w.id, w); });
      return next;
    });
  };

  const changeMode = (m) => setView({ mode: m, page: 1 });

  const tabs = [
    ...(status.last_synced_at ? [{ id: 'new', label: 'New since last import' }] : []),
    { id: 'all', label: 'All Hevy workouts' },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {tabs.length > 1 ? <Tabs tabs={tabs} active={mode} onChange={changeMode} label="Which Hevy workouts" /> : <span />}
        <Button variant="soft" size="sm" icon={RefreshCw} onClick={load} disabled={loading}>Refresh</Button>
      </div>

      {mode === 'new' && status.last_synced_at && (
        <p className="mb-4 text-sm text-gray-500">
          Workouts logged or edited in Hevy since your last import ({formatTimestamp(status.last_synced_at)}).
        </p>
      )}

      {error && (
        <Alert className="mb-4">
          {error}{' '}
          <button type="button" className="font-semibold underline" onClick={load}>Try again</button>
        </Alert>
      )}

      {loading && !data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : workouts.length === 0 && !error ? (
        <EmptyState
          icon={CheckCircle2}
          title={mode === 'new' ? "You're up to date" : 'No workouts in Hevy'}
          description={mode === 'new'
            ? 'Nothing new in Hevy since your last import.'
            : 'Workouts you log in Hevy will show up here.'}
          action={mode === 'new' ? <Button variant="secondary" onClick={() => changeMode('all')}>Browse all Hevy workouts</Button> : null}
        />
      ) : (
        <Card padding="p-1.5" className={loading ? 'opacity-60' : ''}>
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <button
              type="button"
              onClick={toggleNewOnPage}
              disabled={selectable.length === 0}
              className="text-sm font-medium text-primary-600 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              {allSelectableChosen ? 'Clear this page' : 'Select all not yet imported'}
            </button>
            <span className="tabular text-xs text-gray-500">Page {page} of {pageCount}</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {workouts.map((w) => (
              <WorkoutRow
                key={w.id}
                workout={w}
                checked={selected.has(w.id)}
                disabled={full && !selected.has(w.id)}
                onToggle={() => toggle(w)}
              />
            ))}
          </ul>
          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-2 pb-1 pt-2">
              <Button variant="soft" size="sm" icon={ChevronLeft} disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                Newer
              </Button>
              <span className="tabular text-xs text-gray-500">{page} / {pageCount}</span>
              <Button variant="soft" size="sm" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>
                Older <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </Card>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 mt-4 lg:bottom-4">
          <Card padding="p-3" className="flex items-center justify-between gap-3 shadow-lift">
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-gray-900">{plural(selected.size, 'workout')} selected</p>
              <p className="truncate text-xs text-gray-500">
                {full ? `Up to ${MAX_SELECTED} at a time` : 'Selections are kept across pages'}
              </p>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Map())}>Clear</Button>
              <Button size="sm" onClick={onReview}>Review import</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 2: match exercises
// ---------------------------------------------------------------------------

/** Initial choice for each Hevy exercise from the preview's suggestion. */
function initialChoice(entry) {
  if (entry.suggestion) return { action: 'match', exercise_id: String(entry.suggestion.exercise_id), create: entry.new_exercise };
  return { action: 'create', exercise_id: '', create: entry.new_exercise };
}

function ExerciseChoice({ entry, choice, onChange, exerciseOptions }) {
  const setCreate = (field, value) => onChange({ ...choice, create: { ...choice.create, [field]: value } });
  const sourceNote = entry.suggestion?.source === 'saved'
    ? 'Your earlier choice'
    : entry.suggestion?.source === 'name_match' ? 'Matched by name, check it' : 'No match found';

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{entry.title}</p>
          <p className="text-xs text-gray-500">
            {plural(entry.set_count, 'set')} in {plural(entry.workout_count, 'workout')} · {sourceNote}
          </p>
        </div>
        {choice.action === 'create' && <Badge tone="primary">New exercise</Badge>}
        {choice.action === 'skip' && <Badge>Skipped</Badge>}
      </div>

      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <Select
          value={choice.action}
          onChange={(e) => onChange({ ...choice, action: e.target.value })}
          aria-label={`What to do with ${entry.title}`}
        >
          <option value="match">Use existing</option>
          <option value="create">Create new</option>
          <option value="skip">Don&apos;t import</option>
        </Select>

        {choice.action === 'match' && (
          <Select
            value={choice.exercise_id}
            onChange={(e) => onChange({ ...choice, exercise_id: e.target.value })}
            aria-label={`Exercise for ${entry.title}`}
          >
            <option value="">Choose an exercise…</option>
            {exerciseOptions}
          </Select>
        )}

        {choice.action === 'skip' && (
          <p className="self-center text-sm text-gray-500">These sets won&apos;t be imported.</p>
        )}
      </div>

      {choice.action === 'create' && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Name" className="sm:col-span-3">
            <Input value={choice.create.name} onChange={(e) => setCreate('name', e.target.value)} />
          </Field>
          <Field label="Category">
            <Select value={choice.create.category} onChange={(e) => setCreate('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
            </Select>
          </Field>
          <Field label="Main muscle group" className="sm:col-span-2">
            <Select value={choice.create.primary_muscle_group} onChange={(e) => setCreate('primary_muscle_group', e.target.value)}>
              {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>
        </div>
      )}
    </li>
  );
}

function ReviewStep({ selected, onBack, onDone }) {
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [choices, setChoices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const ids = useMemo(() => [...selected.keys()], [selected]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, ex] = await Promise.all([hevyAPI.preview(ids), exercisesAPI.getAll()]);
      setPreview(p);
      setExercises(ex.exercises || []);
      setChoices(Object.fromEntries(p.exercises.map((e) => [e.template_id, initialChoice(e)])));
    } catch (err) {
      setError(err.message || 'Could not load the workouts from Hevy');
    } finally {
      setLoading(false);
    }
  }, [ids]);

  useEffect(() => { load(); }, [load]);

  // Existing exercises grouped by muscle group for the dropdowns
  const exerciseOptions = useMemo(() => {
    const groups = new Map();
    for (const ex of exercises) {
      const g = ex.primary_muscle_group || 'Other';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(ex);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, list]) => (
      <optgroup key={group} label={group}>
        {list.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
      </optgroup>
    ));
  }, [exercises]);

  const problems = useMemo(() => {
    if (!preview) return [];
    return preview.exercises.flatMap((e) => {
      const c = choices[e.template_id];
      if (!c) return [];
      if (c.action === 'match' && !c.exercise_id) return [`Choose an exercise for “${e.title}”`];
      if (c.action === 'create' && !c.create.name.trim()) return [`Enter a name for “${e.title}”`];
      return [];
    });
  }, [preview, choices]);

  const replacing = preview?.workouts.filter((w) => w.status !== 'new') ?? [];
  const allSkipped = preview && preview.exercises.length > 0
    && preview.exercises.every((e) => choices[e.template_id]?.action === 'skip');

  const handleImport = async () => {
    setImporting(true);
    setError('');
    try {
      const payload = Object.fromEntries(Object.entries(choices).map(([id, c]) => {
        if (c.action === 'skip') return [id, { skip: true }];
        if (c.action === 'create') return [id, { create: { ...c.create, name: c.create.name.trim() } }];
        return [id, { exercise_id: Number(c.exercise_id) }];
      }));
      const result = await hevyAPI.importWorkouts(ids, payload);
      toast({ tone: 'success', message: `Imported ${plural(result.imported.length, 'workout')} from Hevy` });
      onDone(result);
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <LoadingState label="Loading workouts from Hevy…" />;
  if (!preview) {
    return (
      <EmptyState
        tone="error"
        title="Couldn't prepare the import"
        description={error}
        action={(
          <>
            <Button variant="secondary" icon={ArrowLeft} onClick={onBack}>Back</Button>
            <Button onClick={load}>Try again</Button>
          </>
        )}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-base font-semibold text-gray-900 sm:text-lg">{plural(preview.workouts.length, 'workout')} to import</h2>
        <ul className="mt-2 space-y-1 text-sm text-gray-600">
          {preview.workouts.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-x-2">
              <span className="font-medium text-gray-900">{w.title}</span>
              <span className="text-xs text-gray-500">{formatWorkoutTime(w.start_time)}</span>
              {STATUS_BADGES[w.status] && <Badge tone={STATUS_BADGES[w.status].tone}>{STATUS_BADGES[w.status].label}</Badge>}
            </li>
          ))}
        </ul>
        {preview.missing.length > 0 && (
          <Alert tone="warning" className="mt-4">
            {plural(preview.missing.length, 'workout')} could not be found in Hevy (deleted there?) and will be left out.
          </Alert>
        )}
        {replacing.length > 0 && (
          <Alert tone="warning" className="mt-4">
            {plural(replacing.length, 'workout')} {replacing.length === 1 ? 'was' : 'were'} imported before.
            Importing again replaces {replacing.length === 1 ? 'its' : 'their'} sets with Hevy&apos;s version,
            including any edits you made here.
          </Alert>
        )}
      </Card>

      {preview.exercises.length > 0 && (
        <Card padding="p-0" className="overflow-hidden">
          <div className="px-4 pb-1 pt-4 sm:px-5">
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Match exercises</h2>
            <p className="text-sm text-gray-500">
              Pick the exercise each Hevy exercise is in this app. Your choices are remembered for next time.
            </p>
          </div>
          <ul className="divide-y divide-gray-100">
            {preview.exercises.map((entry) => (
              <ExerciseChoice
                key={entry.template_id}
                entry={entry}
                choice={choices[entry.template_id]}
                onChange={(c) => setChoices((prev) => ({ ...prev, [entry.template_id]: c }))}
                exerciseOptions={exerciseOptions}
              />
            ))}
          </ul>
        </Card>
      )}

      {error && <Alert>{error}</Alert>}
      {problems.length > 0 && <Alert tone="warning">{problems[0]}</Alert>}
      {allSkipped && <Alert tone="warning">Every exercise is set to &ldquo;Don&apos;t import&rdquo;, so there&apos;s nothing to import.</Alert>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" icon={ArrowLeft} onClick={onBack} disabled={importing}>Back to workouts</Button>
        <Button
          icon={Download}
          onClick={handleImport}
          loading={importing}
          loadingText="Importing…"
          disabled={problems.length > 0 || allSkipped || preview.workouts.length === 0}
        >
          Import {plural(preview.workouts.length, 'workout')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: results
// ---------------------------------------------------------------------------

function ResultStep({ result, onAgain }) {
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900 sm:text-lg">
          <CheckCircle2 className="h-5 w-5 text-success-600" aria-hidden="true" />
          {plural(result.imported.length, 'workout')} imported
        </h2>
        {result.imported.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {result.imported.map((w) => (
              <li key={w.hevy_id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-900">{w.title}</span>
                  <span className="text-xs text-gray-500">
                    {w.date} · {plural(w.set_count, 'set')}{w.action === 'updated' ? ' · replaced earlier import' : ''}
                    {w.skipped_exercises.length > 0 ? ` · left out: ${w.skipped_exercises.join(', ')}` : ''}
                  </span>
                </span>
                <Button variant="ghost" size="sm" to={`/workout/${w.workout_id}`}>View</Button>
              </li>
            ))}
          </ul>
        )}
        {result.created_exercises.length > 0 && (
          <p className="mt-3 text-sm text-gray-600">
            New exercises: {result.created_exercises.map((e) => e.name).join(', ')}
          </p>
        )}
      </Card>

      {result.skipped.length > 0 && (
        <Alert tone="warning" title={`${plural(result.skipped.length, 'workout')} not imported`}>
          <ul className="mt-1 list-disc pl-5">
            {result.skipped.map((s) => <li key={s.hevy_id}>{s.title || 'Unknown workout'}: {s.reason}</li>)}
          </ul>
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onAgain}>Import more</Button>
        <Button to="/workouts">Go to history</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function HevyImport() {
  // The dashboard can send one workout to import: { importWorkout: summary }.
  // It starts selected, on the review step.
  const location = useLocation();
  const preselected = location.state?.importWorkout;
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [step, setStep] = useState(preselected ? 'review' : 'select');
  const [selected, setSelected] = useState(() => new Map(preselected ? [[preselected.id, preselected]] : []));
  const [result, setResult] = useState(null);
  // Which list and page the picker shows; kept here so it survives the review step
  const [view, setView] = useState({ mode: 'new', page: 1 });

  const loadStatus = useCallback(async () => {
    setStatusError('');
    try {
      setStatus(await hevyAPI.getStatus());
    } catch (err) {
      setStatusError(err.message || 'Could not check your Hevy connection');
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const ready = status?.connected && status.key_readable !== false;

  let content;
  if (statusError) {
    content = <EmptyState tone="error" icon={TriangleAlert} title="Couldn't check Hevy" description={statusError} action={<Button onClick={loadStatus}>Try again</Button>} />;
  } else if (!status) {
    content = <LoadingState label="Checking your Hevy connection…" />;
  } else if (!ready) {
    content = <HevyConnectionCard status={status} onChange={setStatus} />;
  } else if (step === 'review') {
    content = <ReviewStep selected={selected} onBack={() => setStep('select')} onDone={(r) => { setResult(r); setStatus(r.status); setSelected(new Map()); setView({ mode: 'new', page: 1 }); setStep('done'); }} />;
  } else if (step === 'done' && result) {
    content = <ResultStep result={result} onAgain={() => { setResult(null); setStep('select'); }} />;
  } else {
    content = <WorkoutPicker status={status} view={view} setView={setView} selected={selected} setSelected={setSelected} onReview={() => setStep('review')} />;
  }

  return (
    <Layout width="max-w-3xl">
      <PageHeader
        backTo="/workouts"
        backLabel="History"
        title="Import from Hevy"
        subtitle={ready
          ? `Choose which Hevy workouts to bring in${status.hevy_username ? ` from ${status.hevy_username}` : ''}.`
          : 'Connect your Hevy account to bring in workouts you logged there.'}
        actions={ready ? <Button variant="soft" size="sm" to="/profile#integrations">Hevy settings</Button> : null}
      />
      {content}
    </Layout>
  );
}

export default HevyImport;
