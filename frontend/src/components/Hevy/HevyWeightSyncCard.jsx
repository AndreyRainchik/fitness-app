import React, { useState } from 'react';
import { CheckCircle2, Upload } from 'lucide-react';
import { hevyAPI } from '../../services/api';
import { Alert, Button, Card, CardHeader, useToast } from '../ui';
import { plural } from '../../utils/format';

/** "2 added · 1 updated" for a sync response. */
function summarize(r) {
  return [
    r.created ? `${r.created} added` : null,
    r.updated ? `${r.updated} updated` : null,
    r.unchanged ? `${r.unchanged} already matched` : null,
    r.failed ? `${r.failed} failed` : null,
  ].filter(Boolean).join(' · ') || 'Nothing to send';
}

/**
 * Send bodyweight entries to Hevy's body measurements.
 * `weight` comes from hevyAPI.getWeightStatus(); onChange(newWeightStatus) after a sync.
 */
function HevyWeightSyncCard({ weight, onChange }) {
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const pending = weight?.pending_count ?? 0;
  const changed = weight?.entries.filter((e) => e.status === 'changed').length ?? 0;

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const r = await hevyAPI.syncWeight();
      setResult(r);
      onChange?.({ entries: r.entries, pending_count: r.pending_count });
      toast({ tone: r.failed ? 'error' : 'success', message: `Bodyweight to Hevy: ${summarize(r)}` });
    } catch (err) {
      setError(err.message || 'Could not send bodyweight to Hevy');
    } finally {
      setSyncing(false);
    }
  };

  const failures = result?.results.filter((x) => x.outcome === 'failed') ?? [];

  return (
    <Card>
      <CardHeader
        icon={Upload}
        title="Send to Hevy"
        subtitle={!weight || weight.entries.length === 0
          ? 'Log a bodyweight entry to send it to Hevy.'
          : pending === 0
            ? 'Every date is in Hevy.'
            : `${plural(pending, 'date')} not in Hevy yet${changed ? ` (${changed} edited here since sending)` : ''}.`}
        action={pending > 0 ? (
          <Button size="sm" icon={Upload} onClick={handleSync} loading={syncing} loadingText="Sending…">
            Send {plural(pending, 'date')}
          </Button>
        ) : weight?.entries.length ? <CheckCircle2 className="h-5 w-5 text-success-600" aria-label="Up to date" /> : null}
      />
      <p className="text-sm text-gray-500">
        Hevy keeps one weight per day, so the latest entry for each date is sent. If Hevy already has
        an entry for that day, only its weight is changed; body fat and other measurements logged in
        Hevy are kept.
      </p>

      {error && <Alert className="mt-4">{error}</Alert>}

      {result && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">Last send: {summarize(result)}</p>
          {result.stopped && (
            <Alert tone="warning">Stopped early: {result.stopped}</Alert>
          )}
          {failures.length > 0 && (
            <Alert tone="warning" title={`${plural(failures.length, 'date')} not sent`}>
              <ul className="mt-1 list-disc pl-5">
                {failures.slice(0, 5).map((f) => <li key={f.date}>{f.date}: {f.error}</li>)}
                {failures.length > 5 && <li>and {failures.length - 5} more</li>}
              </ul>
            </Alert>
          )}
        </div>
      )}
    </Card>
  );
}

export default HevyWeightSyncCard;
