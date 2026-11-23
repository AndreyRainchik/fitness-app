/**
 * Minimal client for Strava's API (https://developers.strava.com/docs/reference/).
 *
 * Configuration (environment):
 *   STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET   from strava.com/settings/api
 *   STRAVA_API_BASE_URL, STRAVA_OAUTH_BASE_URL   overrides (tests only)
 */

const REQUEST_TIMEOUT_MS = 20000;

/** Largest page Strava returns from /athlete/activities. */
export const STRAVA_PAGE_SIZE = 200;

/** Scopes asked for: profile basics and every activity, "Only You" ones included. */
export const STRAVA_SCOPES = 'read,activity:read_all';

export class StravaApiError extends Error {
  constructor(message, status, { rateLimited = false } = {}) {
    super(message);
    this.name = 'StravaApiError';
    this.status = status;
    this.rateLimited = rateLimited;
  }

  /** True when Strava no longer accepts the tokens (revoked or expired refresh token). */
  get isAuthError() {
    return this.status === 401;
  }
}

const apiBase = () => (process.env.STRAVA_API_BASE_URL || 'https://www.strava.com/api/v3').replace(/\/$/, '');
const oauthBase = () => (process.env.STRAVA_OAUTH_BASE_URL || 'https://www.strava.com/oauth').replace(/\/$/, '');

export function stravaConfigured() {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

/** The page on strava.com where the user approves access. */
export function authorizeUrl({ redirectUri, state }) {
  const url = new URL(`${oauthBase()}/authorize`);
  url.searchParams.set('client_id', process.env.STRAVA_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('approval_prompt', 'auto');
  url.searchParams.set('scope', STRAVA_SCOPES);
  url.searchParams.set('state', state);
  return url.toString();
}

async function send(url, options, what) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    const reason = error.name === 'TimeoutError' ? 'timed out' : 'could not be reached';
    throw new StravaApiError(`Strava ${reason}`, 0);
  }

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (response.status === 429) {
    throw new StravaApiError("Strava's request limit was reached. Syncing continues automatically later.", 429, { rateLimited: true });
  }
  if (!response.ok) {
    const detail = body?.message || body?.errors?.[0]?.code || response.statusText;
    throw new StravaApiError(`${what} failed (Strava said: ${detail})`, response.status);
  }
  return body;
}

/** Exchange or refresh tokens. grant: { code } or { refresh_token }. */
async function tokenRequest(grant) {
  const form = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    ...(grant.code ? { code: grant.code, grant_type: 'authorization_code' } : { refresh_token: grant.refresh_token, grant_type: 'refresh_token' }),
  });
  const body = await send(`${oauthBase()}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: form,
  }, grant.code ? 'Connecting to Strava' : 'Refreshing the Strava sign-in');
  if (!body?.access_token || !body?.refresh_token) {
    throw new StravaApiError('Strava returned no tokens', 502);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Number(body.expires_at),
    athlete: body.athlete ?? null,
  };
}

/** Swap the code from the authorize redirect for tokens (and the athlete). */
export const exchangeCode = (code) => tokenRequest({ code });

/** New tokens from a refresh token. Strava may return a new refresh token too. */
export const refreshTokens = (refreshToken) => tokenRequest({ refresh_token: refreshToken });

/** Revoke the app's access. */
export async function deauthorize(accessToken) {
  await send(`${oauthBase()}/deauthorize`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: accessToken }),
  }, 'Disconnecting from Strava');
}

export class StravaClient {
  constructor(accessToken) {
    this.accessToken = accessToken;
  }

  async request(path, query = {}) {
    const url = new URL(`${apiBase()}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    return send(url, { headers: { authorization: `Bearer ${this.accessToken}`, accept: 'application/json' } }, 'Reading from Strava');
  }

  /** One page of activity summaries. after/before are epoch seconds. */
  listActivities({ after, before, page = 1, perPage = STRAVA_PAGE_SIZE } = {}) {
    return this.request('/athlete/activities', { after, before, page, per_page: perPage });
  }

  /** The detailed activity (adds calories, description, splits). */
  getActivity(id) {
    return this.request(`/activities/${encodeURIComponent(id)}`);
  }

  /** Second-by-second data, keyed by type: { time: { data: [...] }, heartrate: {...}, ... }. */
  getStreams(id, keys) {
    return this.request(`/activities/${encodeURIComponent(id)}/streams`, { keys: keys.join(','), key_by_type: true });
  }
}

// ---------------------------------------------------------------------------
// Webhook subscriptions (one per app; see `npm run strava:subscribe`)
// ---------------------------------------------------------------------------

const appCredentials = () => ({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET });

export function listSubscriptions() {
  const url = new URL(`${apiBase()}/push_subscriptions`);
  for (const [k, v] of Object.entries(appCredentials())) url.searchParams.set(k, v);
  return send(url, { headers: { accept: 'application/json' } }, 'Listing webhook subscriptions');
}

export function createSubscription({ callbackUrl, verifyToken }) {
  return send(`${apiBase()}/push_subscriptions`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ ...appCredentials(), callback_url: callbackUrl, verify_token: verifyToken }),
  }, 'Creating the webhook subscription');
}

export function deleteSubscription(id) {
  const url = new URL(`${apiBase()}/push_subscriptions/${encodeURIComponent(id)}`);
  for (const [k, v] of Object.entries(appCredentials())) url.searchParams.set(k, v);
  return send(url, { method: 'DELETE' }, 'Deleting the webhook subscription');
}
