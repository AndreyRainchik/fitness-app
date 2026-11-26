import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { coachAPI } from '../../services/api';
import { Alert, Button, Card, CardHeader, Skeleton, Spinner } from '../ui';
import { formatTimestamp } from '../../utils/format';

const SECTIONS = [
  ['highlights', 'What went well'],
  ['improvements', 'What to work on'],
  ['next_session', 'Next session'],
];

/**
 * The AI coach's feedback on a workout. Saved feedback is shown as is; the
 * user asks for it the first time and can regenerate it later.
 */
function CoachFeedbackCard({ workoutId }) {
  // undefined while loading
  const [status, setStatus] = useState(undefined);
  const [saved, setSaved] = useState(undefined);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setSaved(undefined);
    setError('');
    Promise.all([coachAPI.getStatus(), coachAPI.getFeedback(workoutId)])
      .then(([s, f]) => {
        if (cancelled) return;
        setStatus(s);
        setSaved(f.feedback ? f : null);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(null);
        setSaved(null);
        setError(err.message || "Couldn't load the coach's feedback");
      });
    return () => { cancelled = true; };
  }, [workoutId]);

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      setSaved(await coachAPI.generateFeedback(workoutId));
    } catch (err) {
      setError(err.message || "The coach couldn't write feedback");
    } finally {
      setGenerating(false);
    }
  };

  const loading = saved === undefined;
  const connected = status?.connected && status.key_readable !== false;
  const hasFeedback = Boolean(saved?.feedback);

  let action = null;
  if (!loading && connected) {
    action = hasFeedback
      ? <Button variant="secondary" size="sm" icon={RefreshCw} onClick={generate} disabled={generating}>Regenerate</Button>
      : null;
  }

  return (
    <Card className="mt-6">
      <CardHeader
        icon={Sparkles}
        title="AI coach"
        subtitle={hasFeedback && !generating ? `Written ${formatTimestamp(saved.created_at)}` : 'Feedback on this session from Claude'}
        action={action}
      />

      {error && <Alert className="mb-4">{error}</Alert>}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {generating && (
        <div className="flex items-center gap-3 py-2 text-sm text-gray-600" role="status">
          <Spinner className="h-5 w-5" />
          The coach is reviewing your session…
        </div>
      )}

      {!loading && !generating && hasFeedback && (
        <div className="space-y-4">
          {saved.stale && (
            <Alert tone="info">
              You edited this workout after the feedback was written. Regenerate to include the changes.
            </Alert>
          )}
          <p className="text-sm leading-relaxed text-gray-800">{saved.feedback.summary}</p>
          {SECTIONS.map(([key, label]) => {
            const items = saved.feedback[key] || [];
            if (items.length === 0) return null;
            return (
              <div key={key}>
                <p className="eyebrow mb-1.5">{label}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !generating && !hasFeedback && (
        connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">Ask the coach to review this session against your recent training.</p>
            <Button icon={Sparkles} onClick={generate}>Get feedback</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              {status?.connected
                ? 'Your saved Anthropic API key can no longer be read. Enter it again to use the coach.'
                : 'Add your Anthropic API key to get feedback on your workouts.'}
            </p>
            <Button variant="secondary" to="/profile#integrations">Set up AI coach</Button>
          </div>
        )
      )}
    </Card>
  );
}

export default CoachFeedbackCard;
