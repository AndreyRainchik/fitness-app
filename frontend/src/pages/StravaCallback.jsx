import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { stravaAPI } from '../services/api';
import Layout from '../components/Layout/Layout';
import { Button, EmptyState, LoadingState, useToast } from '../components/ui';

/**
 * Strava sends the browser here after the user approves (or declines) access
 * on strava.com. Finishes connecting, then goes back to Profile > Integrations.
 */
function StravaCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // The code works once; don't send it twice (React dev mode runs effects twice)
    if (started.current) return;
    started.current = true;

    if (params.get('error')) {
      setError(params.get('error') === 'access_denied'
        ? 'You cancelled on Strava, so nothing was connected.'
        : `Strava said: ${params.get('error')}`);
      return;
    }
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) {
      setError('This page needs to be opened by Strava after you approve access.');
      return;
    }
    stravaAPI.exchange({ code, state, scope: params.get('scope') || '' })
      .then(() => {
        toast({ tone: 'success', message: 'Strava connected. Importing your activities…' });
        navigate('/profile#integrations', { replace: true });
      })
      .catch((err) => setError(err.message || 'Could not connect Strava'));
  }, [params, navigate, toast]);

  return (
    <Layout>
      <div className="mx-auto max-w-xl">
        {error ? (
          <EmptyState
            tone="error"
            title="Strava isn't connected"
            description={error}
            action={<Button variant="secondary" to="/profile#integrations">Back to Integrations</Button>}
          />
        ) : (
          <LoadingState label="Connecting Strava…" />
        )}
      </div>
    </Layout>
  );
}

export default StravaCallback;
