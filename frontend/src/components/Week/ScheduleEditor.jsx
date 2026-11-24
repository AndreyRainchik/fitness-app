import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { weekAPI } from '../../services/api';
import { Alert, Button, Modal, Spinner } from '../ui';
import { SLOTS, WEEKDAYS } from './slots';

// Monday first reads more naturally when planning, even though weeks are stored Sunday first
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DEFAULT_DAYS = ['rest', 'lift', 'cardio', 'lift', 'cardio', 'lift', 'cardio'];

const shortName = (name) => String(name).replace(/^Barbell /, '');

/**
 * Dialog for the weekly schedule: what each weekday is for, and for 5/3/1,
 * the order the program's lifts fill the lifting days.
 */
function ScheduleEditor({ open, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [order, setOrder] = useState([]);
  const [program, setProgram] = useState(null);
  const [lifts, setLifts] = useState([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    weekAPI.getSchedule()
      .then((data) => {
        if (cancelled) return;
        setDays(data.days ?? DEFAULT_DAYS);
        setProgram(data.program);
        setLifts(data.program_lifts);
        // Lifts in the saved order first, then any the order doesn't mention
        const rank = new Map((data.lift_order ?? []).map((id, i) => [Number(id), i]));
        const sorted = [...data.program_lifts].sort((a, b) => (rank.get(a.exercise_id) ?? 99) - (rank.get(b.exercise_id) ?? 99));
        setOrder(sorted.map((l) => l.exercise_id));
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [open]);

  const setDay = (index, slot) => setDays((prev) => prev.map((s, i) => (i === index ? slot : s)));
  const move = (index, delta) => setOrder((prev) => {
    const next = [...prev];
    const target = index + delta;
    if (target < 0 || target >= next.length) return prev;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await weekAPI.saveSchedule(days, order);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const liftDays = days.filter((s) => s === 'lift' || s === 'both').length;
  const perDay = liftDays ? Math.max(1, Math.round(lifts.length / liftDays)) : 1;
  const nameOf = new Map(lifts.map((l) => [l.exercise_id, l.name]));
  // 5/3/1 lifts keep fixed days when they divide evenly over the lifting days (as in the week view)
  const fixedDays = liftDays > 0 && perDay * liftDays === order.length;
  const liftWeekdays = DISPLAY_ORDER.filter((wd) => days[wd] === 'lift' || days[wd] === 'both');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Your week"
      size="lg"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={loading}>Save schedule</Button>
        </>
      )}
    >
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          {error && <Alert tone="error">{error}</Alert>}
          <div>
            <p className="mb-3 text-sm text-gray-500">
              Pick what each day is usually for. You can still change a single day from the week view.
            </p>
            <div className="space-y-2">
              {DISPLAY_ORDER.map((index) => (
                <div key={index} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                  <span className="w-24 flex-shrink-0 text-sm font-medium text-gray-700">{WEEKDAYS[index]}</span>
                  <div className="grid flex-1 grid-cols-5 gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label={WEEKDAYS[index]}>
                    {SLOTS.map((slot) => {
                      const selected = days[index] === slot.id;
                      const Icon = slot.icon;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setDay(index, slot.id)}
                          className={`flex min-h-[40px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium transition-all sm:flex-row sm:gap-1.5 sm:text-xs ${
                            selected ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Flexible days have nothing planned; anything you log still shows up.
            </p>
          </div>

          {program?.type === '531' && order.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Lift order</h3>
              <p className="mb-3 text-sm text-gray-500">
                {fixedDays
                  ? <>Each lift has its own day, every week. A lift done early or on another day still counts; a missed one stays on its day.</>
                  : <>{program.name}&apos;s {order.length} lifts don&apos;t divide evenly over {liftDays || 'no'} lifting day{liftDays === 1 ? '' : 's'}, so they rotate in this order, {perDay} per day. A missed day moves its lift to the next lifting day.</>}
              </p>
              <ol className="space-y-1.5">
                {order.map((id, i) => (
                  <li key={id} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5">
                    <span className="w-5 text-sm font-semibold text-gray-400">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium text-gray-800">
                      {shortName(nameOf.get(id))}
                      {fixedDays && liftWeekdays[Math.floor(i / perDay)] != null && (
                        <span className="ml-2 font-normal text-gray-500">{WEEKDAYS[liftWeekdays[Math.floor(i / perDay)]]}</span>
                      )}
                    </span>
                    <Button variant="ghost" size="sm" iconOnly icon={ArrowUp} aria-label={`Move ${shortName(nameOf.get(id))} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                    <Button variant="ghost" size="sm" iconOnly icon={ArrowDown} aria-label={`Move ${shortName(nameOf.get(id))} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)} />
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default ScheduleEditor;
