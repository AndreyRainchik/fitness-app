import React, { useState } from 'react';
import { KeyRound, Sparkles, Unlink } from 'lucide-react';
import { coachAPI } from '../../services/api';
import { Alert, Button, Card, CardHeader, Field, Input, useConfirm, useToast } from '../ui';
import { formatTimestamp } from '../../utils/format';

const STYLE_DESCRIPTIONS = {
  normal: 'Clear, friendly, straight to the point.',
  tough_love: 'Blunt and demanding. Credit only where it\u2019s earned.',
  kawaii: 'Sweet, bubbly cheerleading with cute emojis~',
};

const MODEL_DESCRIPTIONS = {
  'claude-haiku-5-5': 'Fast and very cheap. Good for everyday reviews.',
  'claude-sonnet-5-5': 'Sharper at spotting trends across weeks.',
};

/**
 * A row of choice cards that saves the choice right away.
 * `field` is the status key ('style' or 'model'); `save(id)` stores it and
 * resolves to { [field]: savedId }.
 */
function ChoicePicker({ status, onChange, field, options, title, hint, descriptions, save, columns }) {
  const toast = useToast();
  const [saving, setSaving] = useState(null);

  const choose = async (id) => {
    if (id === status[field] || saving) return;
    setSaving(id);
    try {
      const result = await save(id);
      onChange?.({ ...status, [field]: result[field] });
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't change the ${title.toLowerCase()}: ${err.message}` });
    } finally {
      setSaving(null);
    }
  };

  return (
    <fieldset className="mt-6 border-t border-gray-100 pt-5">
      <legend className="sr-only">{title}</legend>
      <p className="mb-1 text-sm font-medium text-gray-900">{title}</p>
      <p className="mb-3 text-xs text-gray-500">{hint}</p>
      <div className={`grid gap-2 ${columns}`}>
        {options.map(({ id, label, cost }) => {
          const selected = id === status[field];
          return (
            <label
              key={id}
              className={`cursor-pointer rounded-xl border p-3 transition-colors ${selected
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'}`}
            >
              <input
                type="radio"
                name={`coach-${field}`}
                value={id}
                checked={selected}
                onChange={() => choose(id)}
                disabled={Boolean(saving)}
                className="sr-only"
              />
              <span className={`block text-sm font-semibold ${selected ? 'text-primary-700' : 'text-gray-900'}`}>
                {label}{saving === id && '…'}
              </span>
              {descriptions[id] && <span className="mt-0.5 block text-xs text-gray-500">{descriptions[id]}</span>}
              {cost && <span className="mt-1 block text-xs font-medium text-gray-600">{cost[0].toUpperCase() + cost.slice(1)}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Save, replace or remove the Anthropic API key the AI coach uses, and
 * choose the coach's model and style.
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
              <li>Each feedback costs about a tenth of a cent with Claude Haiku or 1.5 cents with Claude Sonnet, billed to your Anthropic account.</li>
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

      {status?.models?.length > 0 && (
        <ChoicePicker
          status={status}
          onChange={onChange}
          field="model"
          options={status.models}
          title="Model"
          hint="Billed to your Anthropic account. Used for new feedback and when you regenerate."
          descriptions={MODEL_DESCRIPTIONS}
          save={coachAPI.setModel}
          columns="sm:grid-cols-2"
        />
      )}

      {status?.styles?.length > 0 && (
        <ChoicePicker
          status={status}
          onChange={onChange}
          field="style"
          options={status.styles}
          title="Coach style"
          hint="Used for new feedback and when you regenerate. The advice is the same; only the tone changes."
          descriptions={STYLE_DESCRIPTIONS}
          save={coachAPI.setStyle}
          columns="sm:grid-cols-3"
        />
      )}
    </Card>
  );
}

export default AiCoachConnectionCard;
