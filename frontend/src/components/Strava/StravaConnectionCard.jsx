import React, { useEffect, useState } from 'react';
import { RefreshCw, Unlink } from 'lucide-react';
import { stravaAPI } from '../../services/api';
import { Alert, Button, Card, CardHeader, Spinner, useConfirm, useToast } from '../ui';
import { formatDate, formatTimestamp, plural } from '../../utils/format';

/** Strava's brand orange, for the connect button and "View on Strava" links. */
export const STRAVA_ORANGE = '#FC5200';

function StravaMark({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M15.39 17.94 13.3 13.82h-3.07L15.39 24l5.15-10.18h-3.07M10.21 0 3.5 13.82h4.08l2.63-5.31 2.62 5.31h4.06Z" />
    </svg>
  );
}

/** "Sync now" outcome as one sentence. */
function describeSync(result) {
  if (result.error) return { tone: 'error', message: result.error };
  const parts = [
    result.imported && `${plural(result.imported, 'new session')}`,
    result.linked && `${plural(result.linked, 'session')} matched`,
    result.updated && `${plural(result.updated, 'session')} updated`,
  ].filter(Boolean);
  const message = parts.length ? `Strava: ${parts.join(', ')}` : 'Already up to date with Strava';
  return result.rate_limited
    ? { tone: 'warning', message: `${message}. Strava's request limit was reached; sync again in 15 minutes for the rest.` }
    : { tone: 'success', message };
}

/**
 * Connect to Strava, see what it brought in, sync now, disconnect.
 * `status` comes from stravaAPI.getStatus(); onChange(newStatus) after any change.
 */
function StravaConnectionCard({ status, onChange }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(null); // 'connect' | 'sync' | null

  // Until the history is in, keep syncing. Each request does a stretch of the
  // import (servers that scale to zero only work while a request is open).
  const importing = status?.connected && !status.history_imported;
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!importing || stalled) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { result, status: next } = await stravaAPI.sync();
        if (cancelled) return;
        // Rate limited or failing: stop here; "Sync now" carries on later
        if (result.rate_limited || result.error) setStalled(true);
        onChange?.(next);
      } catch {
        if (!cancelled) setStalled(true);
      }
    })();
    return () => { cancelled = true; };
  }, [importing, stalled, status?.history_reached, onChange]);

  const connect = async () => {
    setBusy('connect');
    try {
      const { url } = await stravaAPI.authorizeUrl();
      window.location.assign(url);
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't start connecting: ${err.message}` });
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy('sync');
    try {
      const { result, status: next } = await stravaAPI.sync();
      onChange?.(next);
      toast(describeSync(result));
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't sync: ${err.message}` });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    const ok = await confirm({
      title: 'Disconnect Strava?',
      message: 'New activities will stop arriving. Sessions already imported stay.',
      confirmLabel: 'Disconnect',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      onChange?.(await stravaAPI.disconnect());
      toast({ tone: 'success', message: 'Strava disconnected' });
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't disconnect: ${err.message}` });
    }
  };

  const header = (
    <CardHeader
      icon={StravaMark}
      title="Strava"
      subtitle={status?.connected
        ? `Connected${status.athlete_name ? ` as ${status.athlete_name}` : ''}`
        : 'Bring in runs, rides, rows and climbs, and heart rate for your lifting'}
    />
  );

  if (!status?.configured) {
    return (
      <Card>
        {header}
        <p className="text-sm text-gray-600">
          Strava isn&apos;t set up on this server yet. Add <code className="text-xs">STRAVA_CLIENT_ID</code> and{' '}
          <code className="text-xs">STRAVA_CLIENT_SECRET</code> to the server&apos;s environment, then reload.
        </p>
      </Card>
    );
  }

  if (!status.connected) {
    return (
      <Card>
        {header}
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>Cardio sessions are imported with distance, pace, heart rate and route.</li>
          <li>Lifting sessions recorded on your watch add heart rate and calories to the matching workout here.</li>
          <li>New activities arrive by themselves after the first import.</li>
        </ul>
        <button
          type="button"
          onClick={connect}
          disabled={busy === 'connect'}
          className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: STRAVA_ORANGE }}
        >
          {busy === 'connect' ? <Spinner className="h-4 w-4" /> : <StravaMark className="h-4 w-4" />}
          Connect with Strava
        </button>
      </Card>
    );
  }

  const { counts = {} } = status;
  return (
    <Card>
      {header}

      {status.tokens_readable === false && (
        <Alert tone="warning" className="mb-4">
          The saved Strava sign-in can no longer be read (the server&apos;s secret changed). Disconnect and connect again.
        </Alert>
      )}

      {importing && !stalled ? (
        <p className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <Spinner className="h-4 w-4" />
          Importing your Strava history{status.history_reached ? ` (back to ${formatDate(status.history_reached, { month: 'short', year: 'numeric' })})` : ''}…
        </p>
      ) : (
        <p className="mb-1 text-sm text-gray-600">
          {status.last_synced_at ? `Last sync: ${formatTimestamp(status.last_synced_at)}` : 'Not synced yet.'}
          {importing && stalled && ' Older history is still to come: sync again in a while.'}
        </p>
      )}

      <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
        {[
          ['Cardio sessions', counts.cardio ?? 0],
          ['Lifting with HR', counts.strength_linked ?? 0],
          ['Lifting not matched', counts.strength_unmatched ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-gray-50 px-2 py-2.5">
            <dt className="text-[11px] font-medium text-gray-500 sm:text-xs">{label}</dt>
            <dd className="tabular text-lg font-bold text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
      {counts.strength_unmatched > 0 && (
        <p className="mb-4 text-xs text-gray-500">
          Lifting sessions from your watch that don&apos;t match a workout here yet. They match automatically once the workout is imported from Hevy or logged.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button icon={RefreshCw} onClick={sync} loading={busy === 'sync'} loadingText="Syncing…">Sync now</Button>
        <Button variant="danger-subtle" icon={Unlink} onClick={disconnect}>Disconnect</Button>
      </div>
    </Card>
  );
}

export default StravaConnectionCard;

/** "View on Strava" link for a session that came from (or was matched to) a Strava activity. */
export function ViewOnStrava({ activityId, className = '' }) {
  if (!activityId) return null;
  return (
    <a
      href={`https://www.strava.com/activities/${encodeURIComponent(activityId)}`}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-2 hover:underline ${className}`}
      style={{ color: STRAVA_ORANGE }}
    >
      <StravaMark className="h-4 w-4" />
      View on Strava
    </a>
  );
}
