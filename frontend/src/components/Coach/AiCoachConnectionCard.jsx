import React, { useState } from 'react';
import { KeyRound, Sparkles, Unlink } from 'lucide-react';
import { coachAPI } from '../../services/api';
import { Alert, Button, Card, CardHeader, Field, Input, useConfirm, useToast } from '../ui';
import { formatTimestamp } from '../../utils/format';

/**
 * Save, replace or remove the Anthropic API key the AI coach uses.
 * `status` comes from coachAPI.getStatus(); onChange(newStatus) after any change.
 */
function AiCoachConnectionCard({ status, onChange }) {
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
      const next = await coachAPI.connect(apiKey.trim());
      setApiKey('');
      setEditing(false);
      onChange?.(next);
      toast({ tone: 'success', message: 'AI coach is ready' });
    } catch (err) {
      setError(err.message || 'Could not save the key');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: 'Remove API key?',
      message: 'This app will forget your Anthropic API key. Feedback already written stays on your workouts.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      onChange?.(await coachAPI.disconnect());
      toast({ tone: 'success', message: 'API key removed' });
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't remove the key: ${err.message}` });
    }
  };

  return (
    <Card>
      <CardHeader
        icon={Sparkles}
        title="AI coach (Claude)"
        subtitle={connected
          ? `Anthropic API key ending ${status.key_hint}`
          : 'Get feedback on your workouts from Claude'}
      />

      {connected && status.key_readable === false && (
        <Alert tone="warning" className="mb-4">
          Your saved key can no longer be read (the server&apos;s secret changed). Enter it again to keep using the coach.
        </Alert>
      )}

      {connected && !showForm && (
        <>
          <p className="mb-4 text-sm text-gray-600">
            Open any workout and choose <b>Get feedback</b>. Added {formatTimestamp(status.connected_at)}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={KeyRound} onClick={() => setEditing(true)}>Replace key</Button>
            <Button variant="danger-subtle" icon={Unlink} onClick={handleDisconnect}>Remove key</Button>
          </div>
        </>
      )}

      {showForm && (
        <form onSubmit={handleConnect} className="space-y-4">
          {!connected && (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
              <li>
                Sign in at{' '}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:underline">
                  console.anthropic.com
                </a>{' '}
                and add a little credit under Billing. A Claude Pro or Max subscription doesn&apos;t include API use.
              </li>
              <li>Create an API key and paste it below.</li>
              <li>Each feedback costs a fraction of a cent (Claude Haiku), billed to your Anthropic account.</li>
            </ol>
          )}
          {error && <Alert>{error}</Alert>}
          <Field label="Anthropic API key" hint="Stored encrypted on the server and used only to write feedback on your workouts when you ask for it.">
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={saving} loadingText="Checking key…" disabled={!apiKey.trim()}>
              {connected ? 'Save new key' : 'Save key'}
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

export default AiCoachConnectionCard;
