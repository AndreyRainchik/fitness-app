import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cardioAPI, workoutsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout/Layout';
import {
  Alert, Button, Card, EmptyState, Field, Input, LoadingState, PageHeader, Textarea,
} from '../components/ui';
import { getLocalDateString } from '../utils/dateUtils';
import {
  SPORTS, SPORT_IDS, distanceUnit, elevationToMeters, elevationUnit, formatClock, formatPaceOrSpeed,
  metersTo, metersToElevation, paceLabel, parseDuration, sessionTitle, toMeters,
} from '../utils/cardio';

// Where each sport usually happens, for the default when switching sport
const DEFAULT_ENVIRONMENT = { run: 'outdoor', ride: 'outdoor', row: 'indoor', boulder: 'indoor', other: 'outdoor' };
const CADENCE_UNIT = { run: 'spm', ride: 'rpm', row: 'spm' };

const blank = () => ({
  sport: 'run',
  environment: 'outdoor',
  date: getLocalDateString(),
  time: '',
  name: '',
  duration: '',
  distance: '',
  elevation: '',
  avg_hr: '',
  max_hr: '',
  calories: '',
  cadence: '',
  notes: '',
});

const pad = (n) => String(n).padStart(2, '0');
const round = (value, digits) => String(Number(value.toFixed(digits)));

/** A saved session -> form values (in the user's units). */
function toForm(workout, unit) {
  const c = workout.cardio || {};
  const m = workout.metrics || {};
  const start = workout.start_time ? new Date(workout.start_time) : null;
  return {
    sport: c.sport || 'other',
    environment: c.environment || '',
    date: String(workout.date).slice(0, 10),
    time: start && !Number.isNaN(start.getTime()) ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : '',
    name: workout.name || '',
    duration: c.duration_s ? formatClock(c.duration_s) : '',
    distance: c.distance_m ? round(metersTo(c.distance_m, unit), 2) : '',
    elevation: c.elevation_gain_m ? round(metersToElevation(c.elevation_gain_m, unit), 0) : '',
    avg_hr: m.avg_hr ?? '',
    max_hr: m.max_hr ?? '',
    calories: m.calories ?? '',
    cadence: c.avg_cadence ?? '',
    notes: workout.notes || '',
  };
}

const numberOrNull = (value) => (value === '' || value === null || value === undefined ? null : Number(value));

/** Form values -> API body, or { error }. */
function toPayload(form, unit) {
  const duration_s = parseDuration(form.duration);
  if (!duration_s) return { error: 'Enter how long the session took, e.g. 45, 45:30 or 1:05:00' };

  const info = SPORTS[form.sport];
  const distance = numberOrNull(form.distance);
  const elevation = numberOrNull(form.elevation);
  let start_time = null;
  if (form.time) {
    const start = new Date(`${form.date}T${form.time}`);
    if (!Number.isNaN(start.getTime())) start_time = start.toISOString();
  }

  return {
    payload: {
      sport: form.sport,
      environment: form.environment || null,
      date: form.date,
      start_time,
      name: form.name.trim() || null,
      notes: form.notes.trim() || null,
      duration_s,
      distance_m: info.hasDistance && distance > 0 ? Math.round(toMeters(distance, unit) * 10) / 10 : null,
      elevation_gain_m: elevation > 0 ? Math.round(elevationToMeters(elevation, unit)) : null,
      avg_cadence: CADENCE_UNIT[form.sport] ? numberOrNull(form.cadence) : null,
      avg_hr: numberOrNull(form.avg_hr),
      max_hr: numberOrNull(form.max_hr),
      calories: numberOrNull(form.calories),
    },
  };
}

function ChoiceGroup({ label, options, value, onChange }) {
  return (
    <div>
      <p className="mb-1.5 block text-sm font-medium text-gray-700" id={`${label}-label`}>{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`${label}-label`}>
        {options.map(({ id, label: optionLabel, icon: Icon }) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(id)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors ${
                selected
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-surface text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LogCardio() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const unit = distanceUnit(user?.units);

  const [form, setForm] = useState(editing ? null : blank);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { workout } = await workoutsAPI.getById(id);
        if (cancelled) return;
        if (workout.kind !== 'cardio') {
          navigate(`/workouts/${id}/edit`, { replace: true });
          return;
        }
        setForm(toForm(workout, unit));
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load session');
      }
    })();
    return () => { cancelled = true; };
  }, [editing, id, unit, navigate]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const chooseSport = (sport) => setForm((f) => ({
    ...f,
    sport,
    environment: sport === f.sport ? f.environment : DEFAULT_ENVIRONMENT[sport],
  }));

  const preview = useMemo(() => {
    if (!form) return null;
    const seconds = parseDuration(form.duration);
    const distance = Number(form.distance);
    if (!seconds || !(distance > 0) || !SPORTS[form.sport].hasDistance) return null;
    const value = formatPaceOrSpeed(form.sport, toMeters(distance, unit), seconds, unit);
    return value ? `${paceLabel(form.sport)}: ${value}` : null;
  }, [form, unit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { payload, error: formError } = toPayload(form, unit);
    if (formError) {
      setError(formError);
      return;
    }
    setSaving(true);
    try {
      const result = editing ? await cardioAPI.update(id, payload) : await cardioAPI.create(payload);
      navigate(`/workout/${result.workout.id}`);
    } catch (err) {
      setError(err.message || 'Failed to save session');
      setSaving(false);
    }
  };

  const backTo = editing ? `/workout/${id}` : '/workouts';

  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <PageHeader
          backTo={backTo}
          backLabel={editing ? 'Back to session' : 'History'}
          title={editing ? 'Edit cardio session' : 'Log cardio'}
          subtitle={editing ? null : 'A run, ride, row or climbing session'}
        />

        {loadError ? (
          <EmptyState
            tone="error"
            title="Couldn't load this session"
            description={loadError}
            action={<Button variant="secondary" to="/workouts">Back to History</Button>}
          />
        ) : !form ? (
          <LoadingState label="Loading session..." />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {error && <Alert>{error}</Alert>}

            <Card className="space-y-5">
              <ChoiceGroup
                label="Activity"
                value={form.sport}
                onChange={chooseSport}
                options={SPORT_IDS.map((sport) => ({ id: sport, label: SPORTS[sport].label, icon: SPORTS[sport].icon }))}
              />
              {form.sport !== 'boulder' && (
                <ChoiceGroup
                  label="Where"
                  value={form.environment}
                  onChange={(environment) => setForm((f) => ({ ...f, environment }))}
                  options={[
                    { id: 'outdoor', label: 'Outdoor' },
                    { id: 'indoor', label: form.sport === 'run' ? 'Treadmill' : form.sport === 'ride' ? 'Indoor / trainer' : 'Indoor' },
                  ]}
                />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date">
                  <Input type="date" value={form.date} onChange={set('date')} required max={getLocalDateString()} />
                </Field>
                <Field label="Start time" hint="Optional">
                  <Input type="time" value={form.time} onChange={set('time')} />
                </Field>
              </div>
              <Field label="Name" hint="Optional">
                <Input value={form.name} onChange={set('name')} placeholder={sessionTitle(form.sport, form.environment)} maxLength={200} />
              </Field>
            </Card>

            <Card className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Duration" hint="Moving time: minutes, mm:ss or h:mm:ss">
                  <Input value={form.duration} onChange={set('duration')} placeholder="45:00" inputMode="numeric" required />
                </Field>
                {SPORTS[form.sport].hasDistance && (
                  <Field label={`Distance (${unit})`} hint={preview || 'Optional'}>
                    <Input type="number" min="0" step="0.01" value={form.distance} onChange={set('distance')} inputMode="decimal" />
                  </Field>
                )}
                {form.environment === 'outdoor' && (form.sport === 'run' || form.sport === 'ride' || form.sport === 'other') && (
                  <Field label={`Elevation gain (${elevationUnit(unit)})`} hint="Optional">
                    <Input type="number" min="0" step="1" value={form.elevation} onChange={set('elevation')} inputMode="numeric" />
                  </Field>
                )}
                {CADENCE_UNIT[form.sport] && (
                  <Field label={`Avg cadence (${CADENCE_UNIT[form.sport]})`} hint="Optional">
                    <Input type="number" min="0" max="300" step="1" value={form.cadence} onChange={set('cadence')} inputMode="numeric" />
                  </Field>
                )}
              </div>
            </Card>

            <Card className="space-y-5">
              <p className="text-sm font-medium text-gray-700">Heart rate and energy <span className="font-normal text-gray-500">(optional, from your watch)</span></p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Avg HR (bpm)">
                  <Input type="number" min="30" max="250" value={form.avg_hr} onChange={set('avg_hr')} inputMode="numeric" />
                </Field>
                <Field label="Max HR (bpm)">
                  <Input type="number" min="30" max="250" value={form.max_hr} onChange={set('max_hr')} inputMode="numeric" />
                </Field>
                <Field label="Calories" className="col-span-2 sm:col-span-1">
                  <Input type="number" min="0" value={form.calories} onChange={set('calories')} inputMode="numeric" />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="How did it feel?" maxLength={5000} />
              </Field>
            </Card>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => navigate(backTo)}>Cancel</Button>
              <Button type="submit" loading={saving} loadingText="Saving...">
                {editing ? 'Save changes' : 'Save session'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}

export default LogCardio;
