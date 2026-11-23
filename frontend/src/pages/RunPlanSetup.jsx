import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag, Gauge, RefreshCw } from 'lucide-react';
import Layout from '../components/Layout/Layout';
import {
  Alert, Button, Card, CardHeader, Field, Input, LoadingState, PageHeader, Select, useConfirm, useToast,
} from '../components/ui';
import PlanWeeks, { PaceTable } from '../components/Run/PlanWeeks';
import { runPlansAPI } from '../services/api';
import { formatClock, parseDuration } from '../utils/cardio';
import { getLocalDateString } from '../utils/dateUtils';
import { formatDate } from '../utils/format';
import { PHASE_LABELS, WEEKDAY_NAMES, formatPlanDistance } from '../utils/runPlan';

const MILE = 1609.344;
const RESULT_DISTANCES = [
  { key: '1mi', label: 'Mile' }, { key: '5k', label: '5K' }, { key: '10k', label: '10K' },
  { key: 'half', label: 'Half marathon' }, { key: 'marathon', label: 'Marathon' },
];
const DEFAULT_WEEKS = { '5k': 8, '10k': 10, half: 12, marathon: 16 };

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

/** A segmented choice. */
function Segmented({ options, value, onChange, label }) {
  return (
    <div className="grid gap-1 rounded-xl bg-gray-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[40px] rounded-lg px-2 text-sm font-medium transition-all ${value === o.value ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PlanSummary({ plan }) {
  const unit = plan.unit;
  const peak = Math.max(...plan.weeks.map((w) => w.total_m));
  const longest = Math.max(...plan.weeks.flatMap((w) => w.runs.filter((r) => r.role === 'long').map((r) => r.distance_m)), 0);
  const phases = [];
  for (const w of plan.weeks) {
    const last = phases[phases.length - 1];
    if (last && last.phase === w.phase) last.weeks += 1;
    else phases.push({ phase: w.phase, weeks: 1 });
  }
  const types = new Set(plan.weeks.flatMap((w) => w.runs.map((r) => r.session_id)));
  return (
    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      <div><p className="text-gray-500">Weeks</p><p className="text-lg font-semibold text-gray-900">{plan.weeks.length}</p></div>
      <div><p className="text-gray-500">Peak week</p><p className="text-lg font-semibold text-gray-900">{formatPlanDistance(peak, unit)}</p></div>
      <div><p className="text-gray-500">Longest run</p><p className="text-lg font-semibold text-gray-900">{formatPlanDistance(longest, unit)}</p></div>
      <div><p className="text-gray-500">Session types</p><p className="text-lg font-semibold text-gray-900">{types.size}</p></div>
      <p className="col-span-2 text-xs text-gray-500 sm:col-span-4">
        {phases.map((p) => `${PHASE_LABELS[p.phase] ?? p.phase} ${p.weeks} wk`).join(' → ')}
      </p>
    </div>
  );
}

function RunPlanSetup() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const today = getLocalDateString();

  const [setup, setSetup] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [kind, setKind] = useState('race');
  const [raceKey, setRaceKey] = useState('half');
  const [raceDate, setRaceDate] = useState(addDays(today, 7 * DEFAULT_WEEKS.half));
  const [raceName, setRaceName] = useState('');
  const [goal, setGoal] = useState('');
  const [runsPerWeek, setRunsPerWeek] = useState(4);
  const [longDay, setLongDay] = useState(0);
  const [useResult, setUseResult] = useState(false);
  const [resultDistance, setResultDistance] = useState('5k');
  const [resultTime, setResultTime] = useState('');
  const [weekly, setWeekly] = useState('');
  const [longest, setLongest] = useState('');
  const [hills, setHills] = useState(true);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    runPlansAPI.setup()
      .then((data) => {
        setSetup(data);
        if (!data.fitness) setUseResult(true);
        const runDays = (data.schedule.days ?? []).map((s, wd) => ({ s, wd })).filter(({ s }) => s === 'cardio' || s === 'both');
        if (runDays.length) {
          setRunsPerWeek(Math.min(6, Math.max(3, runDays.length)));
          setLongDay(runDays.some(({ wd }) => wd === 0) ? 0 : runDays.some(({ wd }) => wd === 6) ? 6 : runDays[runDays.length - 1].wd);
        }
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  const unit = setup?.unit ?? 'mi';
  const toMeters = (value) => (Number(value) > 0 ? Number(value) * (unit === 'mi' ? MILE : 1000) : undefined);

  const body = useMemo(() => ({
    kind,
    race: kind === 'race' ? { key: raceKey, date: raceDate, name: raceName || undefined, goal_s: parseDuration(goal) || undefined } : undefined,
    runs_per_week: runsPerWeek,
    long_run_weekday: longDay,
    recent_result: useResult ? { distance: resultDistance, seconds: parseDuration(resultTime) } : undefined,
    weekly_m: toMeters(weekly),
    longest_m: toMeters(longest),
    settings: { hills },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toMeters only depends on unit
  }), [kind, raceKey, raceDate, raceName, goal, runsPerWeek, longDay, useResult, resultDistance, resultTime, weekly, longest, hills, unit]);

  // Any change makes the preview stale
  useEffect(() => { setPreview(null); }, [body]);

  const validate = () => {
    if (useResult && !parseDuration(resultTime)) return 'Enter your recent result as a time, e.g. 22:30 or 1:45:00.';
    if (goal && !parseDuration(goal)) return 'Enter the goal time like 1:45:00, or leave it empty.';
    if (kind === 'race' && !raceDate) return 'Choose a race date.';
    return null;
  };

  const runPreview = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy('preview');
    setError(null);
    try {
      setPreview(await runPlansAPI.preview(body));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const start = async () => {
    if (setup?.active && !(await confirm({
      title: 'Replace your current plan?',
      message: 'Your current run plan stops today. Runs you have already done stay in your history.',
      confirmLabel: 'Replace plan',
    }))) return;
    setBusy('save');
    setError(null);
    try {
      await runPlansAPI.create(body);
      toast({ tone: 'success', message: 'Your plan is ready' });
      navigate('/plan');
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  if (loadError) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl"><Alert tone="error">Couldn&apos;t load plan setup: {loadError}</Alert></div>
      </Layout>
    );
  }
  if (!setup) {
    return <Layout><div className="mx-auto max-w-3xl"><LoadingState label="Looking at your recent running..." /></div></Layout>;
  }

  const baseline = setup.baseline;
  const weeksAway = kind === 'race' && raceDate ? Math.round((Date.parse(raceDate) - Date.parse(today)) / (7 * 86400000)) : null;

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <PageHeader backTo="/plan" backLabel="Run plan" title="New run plan" subtitle="Built around your lifting days, from your own running." />

        <div className="space-y-4">
          <Card>
            <CardHeader title="What are you training for?" icon={Flag} />
            <div className="space-y-4">
              <Segmented
                label="Plan type"
                value={kind}
                onChange={setKind}
                options={[{ value: 'race', label: 'A race' }, { value: 'maintain', label: 'Staying fit (maintenance)' }]}
              />
              {kind === 'race' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Distance">
                    <Select value={raceKey} onChange={(e) => { setRaceKey(e.target.value); }}>
                      {setup.races.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Race date" hint={weeksAway != null ? `${weeksAway} weeks away · usually ${DEFAULT_WEEKS[raceKey]} weeks` : null}>
                    <Input type="date" min={addDays(today, 1)} value={raceDate} onChange={(e) => setRaceDate(e.target.value)} />
                  </Field>
                  <Field label="Race name (optional)">
                    <Input value={raceName} onChange={(e) => setRaceName(e.target.value)} placeholder="City Half" maxLength={100} />
                  </Field>
                  <Field label="Goal time (optional)" hint="Sets your race-pace sessions. Training paces come from your current fitness.">
                    <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={raceKey === '5k' ? '22:00' : '1:45:00'} inputMode="numeric" />
                  </Field>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  12 weeks that hold your current running with one quality session a week, a long run and a 5K time trial every 8 weeks.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Your running week" icon={RefreshCw} subtitle={setup.schedule.configured ? 'Runs go on the cardio days in your schedule first.' : 'Set up My Week first so runs fit around your lifting.'} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Runs per week">
                <Segmented label="Runs per week" value={runsPerWeek} onChange={setRunsPerWeek} options={[3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} />
              </Field>
              <Field label="Long run day">
                <Select value={longDay} onChange={(e) => setLongDay(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 0].map((wd) => <option key={wd} value={wd}>{WEEKDAY_NAMES[wd]}</option>)}
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
                <input type="checkbox" checked={hills} onChange={(e) => setHills(e.target.checked)} className="h-4 w-4 rounded" />
                I have hills to train on
              </label>
            </div>
            {!setup.schedule.configured && (
              <Alert tone="info" className="mt-4">Without a schedule, runs can land on any day. <Button variant="ghost" size="xs" to="/week">Set up My Week</Button></Alert>
            )}
          </Card>

          <Card>
            <CardHeader title="Where you are now" icon={Gauge} />
            <div className="space-y-4">
              {setup.fitness && !useResult ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-700">
                    Paces come from your {setup.fitness.effort.label} in <span className="font-semibold">{formatClock(setup.fitness.effort.seconds)}</span> on {formatDate(setup.fitness.effort.date)}
                    {' '}(fitness score {setup.fitness.vdot}).
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => setUseResult(true)}>Use a different result</Button>
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-sm text-gray-600">
                    {setup.fitness ? 'A recent race or time trial result:' : 'No recent run shows your current fitness yet. Enter a recent race or time trial result:'}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Distance">
                      <Select value={resultDistance} onChange={(e) => setResultDistance(e.target.value)}>
                        {RESULT_DISTANCES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                      </Select>
                    </Field>
                    <Field label="Time" hint="e.g. 22:30 or 1:45:00">
                      <Input value={resultTime} onChange={(e) => setResultTime(e.target.value)} placeholder="22:30" inputMode="numeric" />
                    </Field>
                  </div>
                  {setup.fitness && <Button variant="ghost" size="sm" className="mt-2" onClick={() => setUseResult(false)}>Use my recent runs instead</Button>}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`Weekly distance (${unit})`} hint={`Last 4 weeks: ${formatPlanDistance(baseline.weekly_m, unit)} a week`}>
                  <Input type="number" min="0" step="0.5" value={weekly} onChange={(e) => setWeekly(e.target.value)} placeholder={(baseline.weekly_m / (unit === 'mi' ? MILE : 1000)).toFixed(1)} />
                </Field>
                <Field label={`Longest recent run (${unit})`} hint={`Last 6 weeks: ${formatPlanDistance(baseline.longest_m, unit)}`}>
                  <Input type="number" min="0" step="0.5" value={longest} onChange={(e) => setLongest(e.target.value)} placeholder={(baseline.longest_m / (unit === 'mi' ? MILE : 1000)).toFixed(1)} />
                </Field>
              </div>
            </div>
          </Card>

          {error && <Alert tone="error">{error}</Alert>}

          {!preview && (
            <Button size="lg" fullWidth onClick={runPreview} loading={busy === 'preview'} loadingText="Building your plan...">Preview plan</Button>
          )}

          {preview && (
            <>
              <Card>
                <CardHeader title={kind === 'race' ? `${preview.plan.race.label} plan` : 'Maintenance plan'} subtitle={preview.plan.vdot_source} />
                <PlanSummary plan={preview.plan} />
                {preview.plan.warnings.length > 0 && (
                  <Alert tone="warning" className="mt-4" title="Things to know">
                    <ul className="list-disc space-y-1 pl-4">{preview.plan.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                  </Alert>
                )}
              </Card>
              <Card>
                <CardHeader title="Your paces" subtitle="They update when your fitness does." />
                <PaceTable zones={preview.plan.zones} unit={preview.plan.unit} zoneInfo={preview.zone_info} />
              </Card>
              <PlanWeeks weeks={preview.plan.weeks} zones={preview.plan.zones} unit={preview.plan.unit} />
              <div className="sticky bottom-20 z-10 flex gap-2 lg:bottom-4">
                <Button variant="secondary" size="lg" onClick={() => setPreview(null)}>Change</Button>
                <Button size="lg" fullWidth onClick={start} loading={busy === 'save'} loadingText="Saving...">Start this plan</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default RunPlanSetup;
