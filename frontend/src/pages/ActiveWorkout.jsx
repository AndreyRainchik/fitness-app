import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ClipboardList, Pause, Play, Timer, Trash2 } from 'lucide-react';
import { workoutsAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import WorkoutTimer from '../components/Timers/WorkoutTimer';
import RestTimer from '../components/Timers/RestTimer';
import WorkoutEditor from '../components/Workout/WorkoutEditor';
import { Badge, Button, LoadingState, useConfirm } from '../components/ui';
import { getLocalDateString } from '../utils/dateUtils';
import { setsToExerciseBlocks } from '../utils/workoutPayload';
import {
  clearDraft, formatDuration, loadDraft, newTimer, pauseTimer, resumeTimer, saveDraft, workoutElapsedMs,
} from '../utils/workoutDraft';

const REST_KEY = 'restSeconds';
const REST_OPTIONS = [60, 90, 120, 180, 240, 300];

function readRestSeconds() {
  try {
    const v = parseInt(localStorage.getItem(REST_KEY), 10);
    return Number.isFinite(v) && v > 0 ? v : 180;
  } catch {
    return 180;
  }
}

function freshDraft(template) {
  return {
    values: {
      name: template?.name || '',
      date: getLocalDateString(),
      notes: '',
      exercises: setsToExerciseBlocks(template?.sets),
    },
    timer: newTimer(),
    fromTemplate: Boolean(template),
  };
}

function ActiveWorkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const editorRef = useRef(null);

  // The draft this session started from (null until decided)
  const [session, setSession] = useState(null);
  const [timer, setTimer] = useState(null);
  const latestValues = useRef(null);

  const [restSeconds, setRestSeconds] = useState(readRestSeconds);
  const [rest, setRest] = useState(null); // { endsAt, duration }

  // Decide what to load: an unfinished draft, a template/program day, or a blank workout
  const started = useRef(false);
  useEffect(() => {
    // Once per visit (StrictMode runs effects twice in development)
    if (started.current) return;
    started.current = true;
    (async () => {
      const template = location.state?.template;
      const existing = loadDraft();
      let draft = existing;
      if (template && existing) {
        const replace = await confirm({
          title: 'Replace workout in progress?',
          message: `“${existing.values?.name || 'Untitled workout'}” hasn't been saved. Starting “${template.name}” will discard it.`,
          confirmLabel: 'Start new',
          cancelLabel: 'Keep current',
          tone: 'danger',
        });
        draft = replace ? freshDraft(template) : existing;
      } else if (template || !existing) {
        draft = freshDraft(template);
      }
      saveDraft(draft);
      latestValues.current = draft.values;
      setTimer(draft.timer ?? newTimer());
      setSession(draft);
      // Drop the template from history state so a reload resumes the draft instead
      if (location.state) navigate('.', { replace: true, state: null });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((patch) => {
    const current = loadDraft();
    if (!current) return;
    saveDraft({ ...current, ...patch });
  }, []);

  const handleChange = useCallback((values) => {
    latestValues.current = values;
    persist({ values });
  }, [persist]);

  const togglePause = () => {
    setTimer((t) => {
      const next = t.pausedAt ? resumeTimer(t) : pauseTimer(t);
      persist({ timer: next });
      return next;
    });
  };

  const startRest = useCallback((seconds = restSeconds) => {
    setRest({ endsAt: Date.now() + seconds * 1000, duration: seconds });
  }, [restSeconds]);

  const changeRestSeconds = (value) => {
    setRestSeconds(value);
    try { localStorage.setItem(REST_KEY, String(value)); } catch { /* ignore */ }
  };

  const adjustRest = (delta) => {
    setRest((r) => {
      if (!r) return r;
      const endsAt = Math.max(Date.now() + 1000, r.endsAt + delta * 1000);
      return { endsAt, duration: Math.max(r.duration + delta, 1) };
    });
  };

  const handleFinish = async ({ name, date, notes, exercises, sets }) => {
    const minutes = Math.max(1, Math.round(workoutElapsedMs(timer) / 60000));
    const doneSets = exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
    const totalSets = exercises.reduce((n, ex) => n + ex.sets.length, 0);
    const confirmed = await confirm({
      title: 'Finish workout?',
      message: `${name}\n${minutes} min · ${exercises.length} exercise${exercises.length === 1 ? '' : 's'} · ${totalSets} sets${
        doneSets < totalSets ? `\n${totalSets - doneSets} set${totalSets - doneSets === 1 ? " isn't" : "s aren't"} checked off — they'll still be saved.` : ''
      }`,
      confirmLabel: 'Finish & save',
      cancelLabel: 'Keep going',
    });
    if (!confirmed) return false;

    const workout = await workoutsAPI.create({
      name,
      date,
      duration_minutes: minutes,
      ...(notes ? { notes } : {}),
      sets,
    });
    clearDraft();
    navigate(`/workout/${workout.workout.id}`, { replace: true, state: { justFinished: true } });
  };

  const handleDiscard = async () => {
    const confirmed = await confirm({
      title: 'Discard this workout?',
      message: 'Nothing from this session will be saved.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep going',
      tone: 'danger',
    });
    if (confirmed) {
      clearDraft();
      navigate('/dashboard', { replace: true });
    }
  };

  if (!session) {
    return (
      <Layout focus width="max-w-3xl">
        <LoadingState label="Getting your workout ready..." />
      </Layout>
    );
  }

  const paused = Boolean(timer?.pausedAt);

  return (
    <Layout focus width="max-w-3xl">
      {/* Sticky session bar */}
      <div className="pt-safe sticky top-0 z-30 -mx-3 -mt-6 mb-5 border-b border-gray-200/80 bg-canvas/85 px-3 py-3 backdrop-blur-xl min-[360px]:-mx-4 min-[360px]:px-4 sm:-mx-6 sm:px-6 lg:-mt-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/dashboard"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Back to dashboard (your workout stays saved)"
            title="Leave — your workout stays saved"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${paused ? 'bg-warning-500' : 'animate-pulse bg-success-500'}`} />
              <p className="eyebrow whitespace-nowrap">{paused ? 'Paused' : 'Live'}</p>
              {session.fromTemplate && <Badge tone="primary" icon={ClipboardList} className="hidden sm:inline-flex">Template</Badge>}
            </div>
            <WorkoutTimer timer={timer} className="block text-2xl font-bold leading-tight tracking-tight text-gray-900" />
          </div>
          <Button
            variant="soft"
            iconOnly
            icon={paused ? Play : Pause}
            onClick={togglePause}
            aria-label={paused ? 'Resume timer' : 'Pause timer'}
            title={paused ? 'Resume' : 'Pause'}
          />
          <Button
            variant="soft"
            iconOnly
            icon={Trash2}
            onClick={handleDiscard}
            className="!text-danger-600"
            aria-label="Discard workout"
            title="Discard"
          />
          <Button variant="success" icon={Check} onClick={() => editorRef.current?.submit()} aria-label="Finish workout" className="max-[359px]:!px-3">
            <span className="max-[359px]:hidden">Finish</span>
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Timer className="h-4 w-4 flex-shrink-0 text-gray-400" aria-label="Rest length" />
          {/* Chips scroll sideways on narrow phones; the fade hints there are more */}
          <div
            className="scrollbar-none flex min-w-0 flex-1 gap-1.5 overflow-x-auto"
            style={{ maskImage: 'linear-gradient(to right, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent)' }}
            role="radiogroup"
            aria-label="Rest length"
          >
            {REST_OPTIONS.map((sec) => (
              <button
                key={sec}
                type="button"
                role="radio"
                onClick={() => changeRestSeconds(sec)}
                aria-checked={restSeconds === sec}
                className={`tabular h-8 flex-shrink-0 rounded-full px-3 text-xs font-semibold transition-colors ${
                  restSeconds === sec ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {formatDuration(sec * 1000)}
              </button>
            ))}
            <span className="w-4 flex-shrink-0" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={() => startRest()}
            className="h-8 flex-shrink-0 rounded-full border border-gray-200 bg-surface px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Start rest
          </button>
        </div>
      </div>

      <WorkoutEditor
        ref={editorRef}
        initialValues={session.values}
        onChange={handleChange}
        onSubmit={handleFinish}
        onCancel={handleDiscard}
        submitLabel="Finish workout"
        namePlaceholder="e.g., Push Day, Leg Day"
        trackCompletion
        onSetCompleted={() => startRest()}
      />

      <p className="mt-4 text-center text-xs text-gray-400">
        Your workout saves on this device as you go — you can leave and come back.
      </p>

      <RestTimer
        endsAt={rest?.endsAt ?? null}
        duration={rest?.duration ?? restSeconds}
        onAdjust={adjustRest}
        onSkip={() => setRest(null)}
        onComplete={() => setRest(null)}
      />
    </Layout>
  );
}

export default ActiveWorkout;
