import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, CalendarCog, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, CircleDot, Dumbbell, Flame, Footprints,
} from 'lucide-react';
import Layout from '../components/Layout/Layout';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Skeleton, StatTile, useToast } from '../components/ui';
import ScheduleEditor from '../components/Week/ScheduleEditor';
import RunSteps from '../components/Run/RunSteps';
import { SLOTS, addDays, slotInfo } from '../components/Week/slots';
import { useAuth } from '../context/AuthContext';
import { weekAPI } from '../services/api';
import { cardioSummaryLine, distanceUnit, formatDistance, formatDuration, sessionTitle, sportInfo } from '../utils/cardio';
import { formatDate } from '../utils/format';
import { PHASE_LABELS, formatPlanDistance, mainSetSummary } from '../utils/runPlan';

const STATUS = {
  done: { icon: CheckCircle2, className: 'text-success-600', label: 'Done' },
  today: { icon: CircleDot, className: 'text-primary-600', label: 'Today' },
  upcoming: { icon: Circle, className: 'text-gray-300', label: 'Planned' },
  missed: { icon: AlertCircle, className: 'text-warning-600', label: 'Missed' },
  skipped: { icon: Circle, className: 'text-gray-300', label: 'Skipped' },
};

const FORM_LABELS = {
  fresh: 'Fresh',
  neutral: 'Neutral',
  productive: 'Productive',
  overreaching: 'Overreaching',
};

const shortName = (name) => String(name).replace(/^Barbell /, '');

function weekRange(start, end) {
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${formatDate(start)} – ${sameMonth ? formatDate(end, { day: 'numeric' }) : formatDate(end)}`;
}

/** A planned run from the run plan: title, distance and main set; tap for the steps and paces. */
function PlannedRun({ item, runPlan }) {
  const [open, setOpen] = useState(item.status === 'today');
  const status = STATUS[item.status] ?? STATUS.upcoming;
  const StatusIcon = status.icon;
  const run = item.run;
  const unit = runPlan?.unit ?? 'mi';
  const summary = mainSetSummary(run.steps, unit);
  return (
    <div className="flex items-start gap-3">
      <StatusIcon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${status.className}`} aria-label={status.label} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-left"
        >
          <Footprints className="h-4 w-4 text-gray-400" aria-hidden="true" />
          <span className={`font-semibold ${item.status === 'missed' ? 'text-gray-500' : 'text-gray-900'}`}>{run.title}</span>
          <span className="tabular text-sm text-gray-500">{formatPlanDistance(run.distance_m, unit)}</span>
          {run.key && <Badge tone="warning">Key</Badge>}
          {item.status === 'missed' && <Badge tone="warning">Missed</Badge>}
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {summary && !open && <p className="text-sm text-gray-600">{summary}</p>}
        {open && runPlan && (
          <div className="mt-2">
            <RunSteps run={run} zones={runPlan.zones} unit={unit} />
          </div>
        )}
      </div>
      {item.status === 'today' && (
        <Button size="sm" variant="secondary" to="/cardio/new">Log</Button>
      )}
    </div>
  );
}

/** One planned item: a program lifting session, a lifting day, or a cardio day. */
function PlannedItem({ item, units }) {
  const status = STATUS[item.status] ?? STATUS.upcoming;
  const StatusIcon = status.icon;
  const KindIcon = item.kind === 'cardio' ? Footprints : Dumbbell;
  return (
    <div className="flex items-start gap-3">
      <StatusIcon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${status.className}`} aria-label={status.label} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <KindIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
          <span className={`font-semibold ${item.status === 'missed' ? 'text-gray-500' : 'text-gray-900'}`}>{item.title}</span>
          {item.detail && <span className="text-sm text-gray-500">{item.detail}</span>}
          {item.status === 'missed' && <Badge tone="warning">Missed</Badge>}
        </div>
        {item.lifts.length > 0 && item.status !== 'done' && (
          <ul className="mt-1 space-y-0.5 text-sm text-gray-600">
            {item.lifts.filter((l) => l.top_set).map((l) => (
              <li key={l.key} className="tabular">
                {item.lifts.length > 1 ? `${shortName(l.name)}: top set` : 'Top set'} {l.top_set.weight} {units} × {l.top_set.reps}{l.top_set.amrap ? '+' : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
      {item.status === 'today' && item.kind === 'strength' && item.lifts.length > 0 && (
        <Button size="sm" to="/current-week">Start</Button>
      )}
      {item.status === 'today' && item.kind === 'cardio' && (
        <Button size="sm" variant="secondary" to="/cardio/new">Log</Button>
      )}
    </div>
  );
}

/** A session that was done: links to its page. */
function SessionRow({ session, units }) {
  const unit = distanceUnit(units);
  const isCardio = session.kind === 'cardio';
  const Icon = isCardio ? sportInfo(session.sport).icon : Dumbbell;
  const title = session.name || (isCardio ? sessionTitle(session.sport, session.environment) : 'Workout');
  const line = isCardio
    ? cardioSummaryLine(session, unit)
    : [session.exercises.slice(0, 3).map(shortName).join(', ') + (session.exercises.length > 3 ? ` +${session.exercises.length - 3}` : ''),
      session.duration_s ? formatDuration(session.duration_s) : null].filter(Boolean).join(' · ');
  const unmarked = session.program.filter((u) => !u.status);
  return (
    <Link
      to={`/workout/${session.id}`}
      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-gray-50"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900">{title}</span>
        {line && <span className="block truncate text-xs text-gray-500">{line}</span>}
      </span>
      {unmarked.length > 0 && <Badge tone="primary">Not marked</Badge>}
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300" aria-hidden="true" />
    </Link>
  );
}

function DayCard({ day, units, configured, onChangeSlot, changing, runPlan }) {
  const slot = slotInfo(day.slot);
  const SlotIcon = slot.icon;
  // Sessions already shown as the planned item's "done" still get a row, so they can be opened
  const empty = day.planned.length === 0 && day.sessions.length === 0;
  return (
    <Card
      padding="p-4"
      className={day.is_today ? 'ring-2 ring-primary-500/60' : ''}
      aria-current={day.is_today ? 'date' : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-gray-900">
            {day.weekday}
            <span className="whitespace-nowrap text-sm font-normal text-gray-500">{formatDate(day.date)}</span>
            {day.is_today && <Badge tone="primary">Today</Badge>}
          </h2>
        </div>
        {configured && (
          <label className="relative flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-surface px-2.5 py-1.5 text-xs font-medium text-gray-700 focus-within:ring-4 focus-within:ring-primary-500/30 hover:bg-gray-50">
            <SlotIcon className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            {slot.longLabel ?? slot.label}
            {day.overridden && <span className="h-1.5 w-1.5 rounded-full bg-primary-500" title="Changed for this week" />}
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            <select
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              value={day.slot}
              onChange={(e) => onChangeSlot(day.date, e.target.value)}
              disabled={changing}
              aria-label={`What ${day.weekday} ${formatDate(day.date)} is for`}
            >
              {SLOTS.map((s) => <option key={s.id} value={s.id}>{s.longLabel ?? s.label}</option>)}
              {day.overridden && <option value="schedule">Back to usual ({slotInfo(day.usual_slot).longLabel ?? slotInfo(day.usual_slot).label})</option>}
            </select>
          </label>
        )}
      </div>

      {!empty && (
        <div className="mt-3 space-y-3">
          {day.planned.map((item, i) => (item.kind === 'run'
            ? <PlannedRun key={`run-${item.run.id}`} item={item} runPlan={runPlan} />
            : <PlannedItem key={`${item.kind}-${i}`} item={item} units={units} />))}
          {day.sessions.length > 0 && (
            <div className={day.planned.length ? 'border-t border-gray-100 pt-2' : ''}>
              {day.sessions.map((s) => <SessionRow key={s.id} session={s} units={units} />)}
            </div>
          )}
        </div>
      )}
      {empty && configured && (
        <p className="mt-1 text-sm text-gray-400">{day.slot === 'rest' ? 'Rest day' : 'Nothing planned'}</p>
      )}
    </Card>
  );
}

function Summary({ week, units }) {
  const { strength, cardio } = week.summary;
  const unit = distanceUnit(units);
  const load = week.load;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
      <StatTile
        label="Lifting"
        icon={Dumbbell}
        value={week.configured ? `${strength.done} of ${strength.planned}` : strength.sessions}
        hint={[plural(strength.sessions, 'session'), strength.duration_s ? formatDuration(strength.duration_s) : null].filter(Boolean).join(' · ')}
      />
      <StatTile
        label="Cardio"
        icon={Footprints}
        tone="success"
        value={week.configured ? `${cardio.done} of ${cardio.planned}` : cardio.sessions}
        hint={[cardio.planned_run_m ? `${formatDistance(cardio.run_distance_m, unit, 1) ?? `0 ${unit}`} of ${formatDistance(cardio.planned_run_m, unit, 1)} run`
          : cardio.run_distance_m ? `${formatDistance(cardio.run_distance_m, unit, 1)} run` : null, cardio.duration_s ? formatDuration(cardio.duration_s) : null].filter(Boolean).join(' · ') || plural(cardio.sessions, 'session')}
      />
      {load && (
        <div className="col-span-2 lg:col-span-1">
          <StatTile
            label="Training load"
            icon={Flame}
            tone={load.usual && load.load > load.usual * 1.5 ? 'warning' : 'purple'}
            value={load.load}
            hint={[
              load.usual ? `usual week ${load.usual}` : null,
              load.form ? `form ${FORM_LABELS[load.form.status] ?? load.form.status}` : null,
            ].filter(Boolean).join(' · ') || 'this week'}
          />
        </div>
      )}
    </div>
  );
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function ProgramBar({ program }) {
  if (!program) return null;
  return (
    <Card padding="p-4" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-gray-900">{program.name}</p>
        <p className="text-sm text-gray-500">
          {program.position}
          {program.ready_to_advance && ' · every lift is done: complete the week to move on'}
          {!program.ready_to_advance && program.unmarked > 0 && ` · ${plural(program.unmarked, 'lift')} logged but not marked yet`}
        </p>
      </div>
      <Button size="sm" variant={program.ready_to_advance ? 'primary' : 'secondary'} to="/current-week">
        {program.ready_to_advance ? 'Complete week' : 'Program week'}
      </Button>
    </Card>
  );
}

function RunPlanBar({ runPlan }) {
  if (!runPlan) {
    return (
      <Card padding="p-4" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-gray-900">Training for a race?</p>
          <p className="text-sm text-gray-500">Get a run plan that fits around your lifting.</p>
        </div>
        <Button size="sm" variant="secondary" to="/plan/new">Create a run plan</Button>
      </Card>
    );
  }
  const name = runPlan.race ? (runPlan.race.name || `${runPlan.race.label} plan`) : 'Maintenance plan';
  return (
    <Card padding="p-4" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-gray-900">{name}</p>
        <p className="text-sm text-gray-500">
          Week {runPlan.week_index + 1} · {PHASE_LABELS[runPlan.phase] ?? runPlan.phase}
          {runPlan.cutback ? ' · easier week' : ''}
          {runPlan.race ? ` · race ${formatDate(runPlan.race.date)}` : ''}
        </p>
      </div>
      <Button size="sm" variant="secondary" to="/plan">Run plan</Button>
    </Card>
  );
}

function Week() {
  const { user } = useAuth();
  const units = user?.units || 'lbs';
  const toast = useToast();
  const [start, setStart] = useState(null);
  const [week, setWeek] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [changing, setChanging] = useState(false);

  const load = useCallback(async (weekStart) => {
    try {
      setError(null);
      setWeek(await weekAPI.get(weekStart));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(start); }, [load, start]);

  const shift = (weeks) => {
    if (!week) return;
    setWeek(null);
    setStart(addDays(week.week_start, weeks * 7));
  };

  const changeSlot = async (date, value) => {
    setChanging(true);
    try {
      if (value === 'schedule') await weekAPI.resetDay(date);
      else await weekAPI.setDay(date, value);
      await load(start);
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't change the day: ${err.message}` });
    } finally {
      setChanging(false);
    }
  };

  const isThisWeek = week && week.week_start <= week.today && week.today <= week.week_end;

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow={isThisWeek ? 'This week' : week ? (week.week_start > week.today ? 'Coming up' : 'Past week') : null}
          title="My Week"
          subtitle={week ? weekRange(week.week_start, week.week_end) : ' '}
          actions={(
            <>
              <div className="flex gap-1">
                <Button variant="secondary" size="md" iconOnly icon={ChevronLeft} aria-label="Previous week" onClick={() => shift(-1)} disabled={!week} />
                {!isThisWeek && week && <Button variant="secondary" onClick={() => { setWeek(null); setStart(null); }}>This week</Button>}
                <Button variant="secondary" size="md" iconOnly icon={ChevronRight} aria-label="Next week" onClick={() => shift(1)} disabled={!week} />
              </div>
              <Button variant="soft" icon={CalendarCog} onClick={() => setEditing(true)}>Schedule</Button>
            </>
          )}
        />

        {error && (
          <Alert tone="error" className="mb-4">
            Couldn&apos;t load the week: {error}{' '}
            <button type="button" className="font-semibold underline" onClick={() => load(start)}>Try again</button>
          </Alert>
        )}

        {!week && !error && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        )}

        {week && (
          <>
            {!week.configured && (
              <div className="mb-6">
                <EmptyState
                  icon={CalendarCog}
                  title="Plan your week"
                  description="Choose your lifting and cardio days. Your program's lifts land on lifting days, and anything you log or sync ticks them off."
                  action={<Button onClick={() => setEditing(true)}>Set up my week</Button>}
                />
              </div>
            )}
            <Summary week={week} units={units} />
            {week.configured && <ProgramBar program={week.program} />}
            <RunPlanBar runPlan={week.run_plan} />
            <div className="space-y-3">
              {week.days.map((day) => (
                <DayCard
                  key={day.date}
                  day={day}
                  units={units}
                  configured={week.configured}
                  onChangeSlot={changeSlot}
                  runPlan={week.run_plan}
                  changing={changing}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <ScheduleEditor
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={() => {
          toast({ tone: 'success', message: 'Schedule saved' });
          load(start);
        }}
      />
    </Layout>
  );
}

export default Week;
