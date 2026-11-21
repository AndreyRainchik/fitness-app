#!/usr/bin/env node
/**
 * Register this app's webhook with Strava, so new, changed and deleted
 * activities arrive without waiting for a sync. Strava allows one
 * subscription per app; run this once after deploying.
 *
 *   npm run strava:subscribe -- https://your-app.example.com/api/strava/webhook
 *   npm run strava:subscribe -- --list
 *   npm run strava:subscribe -- --delete <subscription id>
 *
 * Needs STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET and STRAVA_WEBHOOK_VERIFY_TOKEN
 * (the same values as the deployed app; .env is read if present). Strava
 * checks the URL straight away, so the app must already be running there.
 */
import 'dotenv/config';
import { createSubscription, deleteSubscription, listSubscriptions } from './services/stravaClient.js';

const [arg, value] = process.argv.slice(2);

try {
  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
    throw new Error('Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET first');
  }
  if (!arg || arg === '--list') {
    const subs = await listSubscriptions();
    console.log(subs?.length ? subs.map((s) => `#${s.id}  ${s.callback_url}`).join('\n') : 'No webhook subscription');
  } else if (arg === '--delete') {
    if (!value) throw new Error('Give the subscription id to delete (see --list)');
    await deleteSubscription(value);
    console.log(`Deleted subscription #${value}`);
  } else {
    if (!/^https:\/\/.+\/api\/strava\/webhook$/.test(arg)) {
      throw new Error('The callback URL must be https://<your app>/api/strava/webhook');
    }
    if (!process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) throw new Error('Set STRAVA_WEBHOOK_VERIFY_TOKEN first');
    const existing = await listSubscriptions();
    if (existing?.length) {
      throw new Error(`Strava allows one subscription per app and #${existing[0].id} already points at ${existing[0].callback_url}. Delete it first with --delete ${existing[0].id}`);
    }
    const sub = await createSubscription({ callbackUrl: arg, verifyToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN });
    console.log(`Subscribed (#${sub.id}). Strava will now send activity changes to ${arg}`);
  }
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}
