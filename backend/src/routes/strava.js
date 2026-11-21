import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { StravaConnection } from '../models/Strava.js';
import {
  StravaApiError, authorizeUrl, deauthorize, exchangeCode, stravaConfigured,
} from '../services/stravaClient.js';
import { handleWebhookEvent, syncStrava } from '../services/stravaSync.js';

/**
 * Sync activities from Strava.
 *
 *   GET    /api/strava/webhook     Strava checks the webhook subscription (no sign-in)
 *   POST   /api/strava/webhook     Strava reports a new / changed / deleted activity (no sign-in)
 *   GET    /api/strava/status      connection status and sync progress
 *   POST   /api/strava/authorize   the strava.com URL to send the user to
 *   POST   /api/strava/exchange    finish connecting with the code Strava redirected back with
 *   POST   /api/strava/sync        import new activities and more history now
 *   DELETE /api/strava/connection  disconnect (imported sessions stay)
 *
 * Environment: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and
 * STRAVA_WEBHOOK_VERIFY_TOKEN (any random string, used when subscribing).
 */

const router = express.Router();

// ---------------------------------------------------------------------------
// Webhook (called by Strava, not the browser)
// ---------------------------------------------------------------------------

router.get('/webhook', (req, res) => {
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  if (req.query['hub.mode'] === 'subscribe' && verifyToken && req.query['hub.verify_token'] === verifyToken) {
    return res.json({ 'hub.challenge': req.query['hub.challenge'] });
  }
  res.status(403).json({ error: 'Verification failed' });
});

// How long a webhook waits for its import before answering (Strava allows two seconds)
const WEBHOOK_WAIT_MS = 1500;

router.post('/webhook', async (req, res) => {
  // Do the work while answering: hosts like Cloud Run may pause the CPU once
  // the response is sent. Anything slower finishes in the background, and the
  // next sync picks up whatever didn't.
  const work = handleWebhookEvent(req.body);
  let timer;
  await Promise.race([work, new Promise((resolve) => { timer = setTimeout(resolve, WEBHOOK_WAIT_MS); })]);
  clearTimeout(timer);
  res.status(200).json({ ok: true });
});

// ---------------------------------------------------------------------------
// Signed-in routes
// ---------------------------------------------------------------------------

router.use(authenticateToken);

const jwtSecret = () => Buffer.from(process.env.JWT_SECRET, 'base64');
const status = (userId) => ({ configured: stravaConfigured(), ...StravaConnection.status(userId) });

function requireConfigured(req, res, next) {
  if (stravaConfigured()) return next();
  res.status(503).json({ error: 'Strava is not set up on this server (STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET)', code: 'strava_not_configured' });
}

function firstError(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ error: errors.array()[0].msg });
  return true;
}

function stravaError(res, error, fallback) {
  if (error instanceof StravaApiError) {
    return res.status(error.rateLimited ? 429 : 502).json({ error: error.message });
  }
  console.error(`${fallback}:`, error);
  return res.status(500).json({ error: fallback });
}

router.get('/status', (req, res) => {
  res.json(status(req.user.id));
});

/** The redirect must come back to this app's /strava/callback page. */
const isCallbackUrl = (value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.pathname === '/strava/callback';
  } catch {
    return false;
  }
};

router.post('/authorize',
  requireConfigured,
  [body('redirect_uri').custom(isCallbackUrl).withMessage('redirect_uri must be this app’s /strava/callback page')],
  (req, res) => {
    if (firstError(req, res)) return;
    // Ties the redirect back to this user, and expires
    const state = jwt.sign({ sub: req.user.id, purpose: 'strava-connect' }, jwtSecret(), { expiresIn: '15m' });
    res.json({ url: authorizeUrl({ redirectUri: req.body.redirect_uri, state }) });
  }
);

router.post('/exchange',
  requireConfigured,
  [
    body('code').isString().notEmpty().withMessage('Missing code from Strava'),
    body('state').isString().notEmpty().withMessage('Missing state'),
    body('scope').optional().isString(),
  ],
  async (req, res) => {
    if (firstError(req, res)) return;
    try {
      const claims = jwt.verify(req.body.state, jwtSecret());
      if (claims.purpose !== 'strava-connect' || claims.sub !== req.user.id) throw new Error('mismatch');
    } catch {
      return res.status(400).json({ error: 'This Strava sign-in link expired or belongs to another account. Try connecting again.' });
    }

    const scope = req.body.scope || '';
    if (!scope.split(',').some((s) => s === 'activity:read_all' || s === 'activity:read')) {
      return res.status(400).json({
        error: 'Strava didn’t allow reading your activities. Connect again and leave “View data about your activities” ticked.',
        code: 'strava_scope_missing',
      });
    }

    try {
      const tokens = await exchangeCode(req.body.code);
      const athlete = tokens.athlete || {};
      if (!athlete.id) return res.status(502).json({ error: 'Strava did not say which athlete signed in' });

      const other = StravaConnection.findByAthlete(athlete.id);
      if (other && other.user_id !== req.user.id) {
        return res.status(409).json({ error: 'That Strava account is already connected to another account here' });
      }

      StravaConnection.save(req.user.id, {
        athleteId: athlete.id,
        athleteName: [athlete.firstname, athlete.lastname].filter(Boolean).join(' ') || null,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope,
      });

      // First import starts now; the Strava card keeps calling /sync until the
      // history is in (each call waits for the one before it)
      syncStrava(req.user.id).catch((error) => console.error('Strava first sync error:', error));
      res.json({ ...status(req.user.id), syncing: true });
    } catch (error) {
      stravaError(res, error, 'Failed to connect Strava');
    }
  }
);

router.post('/sync', requireConfigured, async (req, res) => {
  if (!StravaConnection.find(req.user.id)) {
    return res.status(400).json({ error: 'Strava is not connected', code: 'strava_not_connected' });
  }
  try {
    const result = await syncStrava(req.user.id);
    res.json({ result, status: status(req.user.id) });
  } catch (error) {
    stravaError(res, error, 'Failed to sync Strava');
  }
});

router.delete('/connection', async (req, res) => {
  try {
    const tokens = StravaConnection.tokens(req.user.id);
    if (tokens && stravaConfigured()) {
      // Best effort: revoke on Strava too
      await deauthorize(tokens.accessToken).catch((error) => console.warn('Strava deauthorize failed:', error.message));
    }
    StravaConnection.remove(req.user.id);
    res.json(status(req.user.id));
  } catch (error) {
    stravaError(res, error, 'Failed to disconnect Strava');
  }
});

export default router;
