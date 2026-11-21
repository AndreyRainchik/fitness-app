import React, { useState } from 'react';
import { Download, KeyRound, Link2, Unlink } from 'lucide-react';
import { hevyAPI } from '../../services/api';
import { Alert, Button, Card, CardHeader, Field, Input, useConfirm, useToast } from '../ui';
import { formatTimestamp } from '../../utils/format';

/**
 * Connect, replace or remove the user's Hevy API key.
 * `status` comes from hevyAPI.getStatus(); onChange(newStatus) after any change.
 * `showImportLink` adds a button to the import screen once connected.
 */
function HevyConnectionCard({ status, onChange, showImportLink = false }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [apiKey, setApiKey] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const connected = status?.connected;
  const showForm = !connected || editing || status?.key_readable === false;

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSaving(true);
    setError('');
    try {
      const next = await hevyAPI.connect(apiKey.trim());
      setApiKey('');
      setEditing(false);
      onChange?.(next);
      toast({ tone: 'success', message: 'Hevy connected' });
    } catch (err) {
      setError(err.message || 'Could not connect to Hevy');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: 'Disconnect Hevy?',
      message: 'This app will forget your Hevy API key. Workouts you already imported stay.',
      confirmLabel: 'Disconnect',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      onChange?.(await hevyAPI.disconnect());
      toast({ tone: 'success', message: 'Hevy disconnected' });
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't disconnect: ${err.message}` });
    }
  };

  return (
    <Card>
      <CardHeader
        icon={Link2}
        title="Hevy"
        subtitle={connected
          ? `Connected${status.hevy_username ? ` as ${status.hevy_username}` : ''} · key ending ${status.key_hint}`
          : 'Import workouts from Hevy and send your bodyweight to it'}
      />

      {connected && status.key_readable === false && (
        <Alert tone="warning" className="mb-4">
          Your saved key can no longer be read (the server&apos;s secret changed). Enter it again to keep importing.
        </Alert>
      )}

      {connected && !showForm && (
        <>
          <p className="mb-4 text-sm text-gray-600">
            {status.last_synced_at
              ? `Last import: ${formatTimestamp(status.last_synced_at)}`
              : 'No workouts imported yet.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {showImportLink && <Button to="/import/hevy" icon={Download}>Import workouts</Button>}
            <Button variant="secondary" icon={KeyRound} onClick={() => setEditing(true)}>Replace key</Button>
            <Button variant="danger-subtle" icon={Unlink} onClick={handleDisconnect}>Disconnect</Button>
          </div>
        </>
      )}

      {showForm && (
        <form onSubmit={handleConnect} className="space-y-4">
          {!connected && (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
              <li>You need Hevy Pro to use Hevy&apos;s API.</li>
              <li>
                Sign in at{' '}
                <a href="https://hevy.com/settings" target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:underline">
                  hevy.com
                </a>{' '}
                and open Settings &gt; Developer.
              </li>
              <li>Generate an API key and paste it below.</li>
            </ol>
          )}
          {error && <Alert>{error}</Alert>}
          <Field label="Hevy API key" hint="Stored encrypted on the server. Used to read your Hevy workouts and to send your bodyweight to Hevy.">
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={saving} loadingText="Checking key…" disabled={!apiKey.trim()}>
              {connected ? 'Save new key' : 'Connect Hevy'}
            </Button>
            {connected && editing && (
              <Button variant="secondary" onClick={() => { setEditing(false); setError(''); setApiKey(''); }}>Cancel</Button>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}

export default HevyConnectionCard;
