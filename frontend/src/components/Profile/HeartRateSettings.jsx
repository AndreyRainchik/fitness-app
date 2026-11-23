import React, { useEffect, useState } from 'react';
import { HeartPulse, History, Trash2 } from 'lucide-react';
import { cardioAPI } from '../../services/api';
import {
  Alert, Button, Card, CardHeader, EmptyState, Field, Input, LoadingState, useConfirm, useToast,
} from '../ui';
import { ZONE_COLORS } from '../Cardio/ZoneBreakdown';
import { getLocalDateString } from '../../utils/dateUtils';
import { formatDate } from '../../utils/format';

/**
 * Max and resting heart rate, dated: each session's zones use the settings
 * in effect on its date, so updating them later doesn't rewrite history.
 */
function HeartRateSettings() {
  const confirm = useConfirm();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ effective_date: getLocalDateString(), max_hr: '', resting_hr: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cardioAPI.getThresholds()
      .then((result) => {
        setData(result);
        const current = result.thresholds[0];
        setForm((f) => ({
          ...f,
          max_hr: current?.max_hr ?? result.suggestion?.max_hr ?? '',
          resting_hr: current?.resting_hr ?? '',
          // The first settings apply to all past sessions too
          effective_date: result.thresholds.length ? getLocalDateString() : '2000-01-01',
        }));
      })
      .catch((err) => setLoadError(err.message || 'Could not load heart rate settings'));
  }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const result = await cardioAPI.saveThresholds({
        effective_date: form.effective_date,
        max_hr: Number(form.max_hr),
        resting_hr: form.resting_hr === '' ? null : Number(form.resting_hr),
      });
      setData(result);
      toast({ tone: 'success', message: 'Heart rate zones saved' });
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    const ok = await confirm({
      title: 'Delete these settings?',
      message: `Max ${t.max_hr} bpm from ${formatDate(t.effective_date, { month: 'short', day: 'numeric', year: 'numeric' })}. Sessions from then on use the settings before them.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      setData(await cardioAPI.deleteThresholds(t.id));
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't delete: ${err.message}` });
    }
  };

  if (loadError) return <EmptyState tone="error" title="Couldn't load heart rate settings" description={loadError} />;
  if (!data) return <LoadingState label="Loading heart rate settings..." />;

  const first = data.thresholds.length === 0;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={HeartPulse}
          title="Heart rate zones"
          subtitle={data.zones ? 'Five zones from your max heart rate' : 'Set your max heart rate to see time in zones'}
        />
        {data.zones && (
          <ul className="mb-6 space-y-2 text-sm">
            {data.zones.map((z, i) => (
              <li key={z.zone} className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-sm" style={{ background: ZONE_COLORS[i] }} aria-hidden="true" />
                <span className="w-32 font-medium text-gray-900">Z{z.zone} <span className="font-normal text-gray-500">{z.name}</span></span>
                <span className="tabular text-gray-700">{z.min}–{z.max} bpm</span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={save} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Max heart rate (bpm)"
              hint={data.suggestion ? `Highest in a session this past year: ${data.suggestion.max_hr} on ${formatDate(data.suggestion.date)}` : 'From a race or hard test effort'}
            >
              <Input type="number" min="100" max="230" required value={form.max_hr} onChange={set('max_hr')} inputMode="numeric" />
            </Field>
            <Field label="Resting heart rate (bpm)" hint="Optional. With it, zones use heart rate reserve.">
              <Input type="number" min="25" max="120" value={form.resting_hr} onChange={set('resting_hr')} inputMode="numeric" />
            </Field>
            <Field label="From" hint={first ? 'First settings apply to every session' : 'Earlier sessions keep their settings'}>
              <Input type="date" required value={form.effective_date} onChange={set('effective_date')} max={getLocalDateString()} />
            </Field>
          </div>
          <Button type="submit" loading={saving} loadingText="Saving…" disabled={!form.max_hr}>
            {first ? 'Save zones' : 'Save new settings'}
          </Button>
        </form>
      </Card>

      {data.thresholds.length > 0 && (
        <Card>
          <CardHeader icon={History} title="Settings history" subtitle="Each session uses the settings in effect on its date" />
          <ul className="divide-y divide-gray-100 text-sm">
            {data.thresholds.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="tabular w-32 text-gray-500">
                  {t.effective_date <= '2000-01-01' ? 'From the start' : `From ${formatDate(t.effective_date, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                </span>
                <span className="tabular flex-1 text-gray-900">
                  Max {t.max_hr} bpm{t.resting_hr ? ` · resting ${t.resting_hr} bpm` : ''}
                </span>
                <Button variant="ghost" size="sm" iconOnly icon={Trash2} onClick={() => remove(t)} aria-label="Delete these settings" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default HeartRateSettings;
