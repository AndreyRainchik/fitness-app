import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus, SkipForward, Timer } from 'lucide-react';

/** Short two-tone beep via Web Audio (no audio file needed). */
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.18].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = i === 0 ? 880 : 1175;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.17);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    // Audio blocked: vibration and the visual cue still work
  }
}

const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Floating rest countdown.
 *
 * Props:
 * - endsAt: timestamp when rest ends (null hides the timer)
 * - duration: total rest in seconds (for the progress ring)
 * - onAdjust(deltaSeconds): +/- buttons
 * - onSkip(): user dismissed it
 * - onComplete(): reached zero
 */
function RestTimer({ endsAt, duration, onAdjust, onSkip, onComplete }) {
  const [now, setNow] = useState(() => Date.now());
  const completedFor = useRef(null);

  useEffect(() => {
    if (!endsAt) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;

  useEffect(() => {
    if (!endsAt || remaining > 0 || completedFor.current === endsAt) return;
    completedFor.current = endsAt;
    beep();
    navigator.vibrate?.([200, 100, 200]);
    onComplete?.();
  }, [endsAt, remaining, onComplete]);

  if (!endsAt || remaining <= 0) return null;

  const progress = duration > 0 ? Math.min(1, remaining / duration) : 0;
  const almostDone = remaining <= 10;
  const m = Math.floor(remaining / 60);
  const s = String(remaining % 60).padStart(2, '0');

  return (
    <div
      className="pb-safe fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 sm:pb-6"
      role="timer"
      aria-live="off"
      aria-label={`Rest timer, ${m} minutes ${s} seconds left`}
    >
      <div className="flex w-full max-w-md animate-slide-up items-center gap-3 rounded-2xl border border-gray-200/80 bg-surface/95 p-2.5 pr-3 shadow-lift backdrop-blur-xl">
        <div className="relative h-14 w-14 flex-shrink-0">
          <svg viewBox="0 0 52 52" className="h-14 w-14 -rotate-90">
            <circle cx="26" cy="26" r={RADIUS} fill="none" strokeWidth="4" className="stroke-gray-100" />
            <circle
              cx="26"
              cy="26"
              r={RADIUS}
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
              className={`transition-[stroke-dashoffset] duration-300 ease-linear ${almostDone ? 'stroke-danger-500' : 'stroke-primary-500'}`}
            />
          </svg>
          <Timer className={`absolute inset-0 m-auto h-5 w-5 ${almostDone ? 'text-danger-500' : 'text-primary-500'}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Rest</p>
          <p className={`tabular text-3xl font-bold leading-none tracking-tight ${almostDone ? 'text-danger-600' : 'text-gray-900'}`}>
            {m}:{s}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onAdjust(-15)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200" aria-label="15 seconds less">
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onAdjust(15)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200" aria-label="15 seconds more">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" onClick={onSkip} className="ml-1 flex h-10 items-center gap-1.5 rounded-xl bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-500">
            <SkipForward className="h-4 w-4" />
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

export default RestTimer;
