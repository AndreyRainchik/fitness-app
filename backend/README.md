# Fitness App Backend

## Setup Complete ✅

### Database Setup ✅
- **SQLite database**: `fitness.db` (48KB)
- **6 tables created**: users, exercises, workouts, sets, programs, program_lifts
- **34 exercises seeded**: Common barbell, dumbbell, and bodyweight exercises
- **Indexes created**: For optimized queries

### Test Database:
```bash
node src/test-db.js      # Test database connection
node src/test-models.js  # Test all models (comprehensive)
```

### Installed Dependencies:
- **express**: Web framework
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment variable management
- **bcryptjs**: Password hashing (pure JS)
- **jsonwebtoken**: JWT authentication
- **sql.js**: SQLite database (pure JS)
- **express-validator**: Input validation

### Project Structure:
```
backend/
├── src/
│   ├── config/       # Database configuration ✅
│   ├── models/       # Data models ✅
│   │   ├── User.js        # User authentication & profiles
│   │   ├── Exercise.js    # Exercise library
│   │   ├── Workout.js     # Workout sessions
│   │   ├── Set.js         # Individual sets
│   │   ├── Program.js     # Training programs
│   │   ├── index.js       # Model exports
│   │   └── README.md      # Models documentation
│   ├── routes/       # API routes (next step)
│   ├── middleware/   # Custom middleware (next step)
│   ├── utils/        # Helper functions (next step)
│   └── server.js     # Main Express server ✅
├── package.json      # Dependencies ✅
└── .env              # Environment variables ✅
```

### Available Scripts:
- `npm start`: Start the server
- `npm run dev`: Start with auto-reload (Node 18+)
- `npm run test:hevy`: Hevy import tests (uses a fake Hevy server and a throwaway database)
- `npm run test:cardio`: cardio session and training summary tests
- `npm run test:strava`: Strava sync tests (fake Strava server, throwaway database)
- `npm run strava:subscribe -- <https://your-app/api/strava/webhook>`: register the Strava webhook (once per deployment; `--list`, `--delete <id>`)

### Environment Variables (.env):
- `PORT=3000`: Server port
- `NODE_ENV=development`: Environment
- `JWT_SECRET`: Secret for JWT tokens
- `DB_PATH=./fitness.db`: SQLite database path
- `SECRETS_ENCRYPTION_KEY` (optional): Key for encrypting stored Hevy API keys. Defaults to one derived from `JWT_SECRET`; changing either means users re-enter their Hevy key.
- `HEVY_API_BASE_URL` (optional): Override `https://api.hevyapp.com` (tests only)
- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`: from strava.com/settings/api. Without them the Strava card says Strava isn't set up.
- `STRAVA_WEBHOOK_VERIFY_TOKEN`: any random string; Strava sends it back when the webhook is registered
- `STRAVA_DETAIL_LIMIT` (default 25), `STRAVA_BACKFILL_PAGES` (default 10), `STRAVA_STREAM_LIMIT` (default 20): per-sync request budget (see below)
- `STREAMS_DIR` (optional): where second-by-second session data is kept. Default: a `streams` folder next to the database file (so on Cloud Run it sits on the same storage mount)
- `STRAVA_API_BASE_URL`, `STRAVA_OAUTH_BASE_URL` (optional): overrides (tests only)

### Current Endpoints:
- `GET /health`: Health check
- `GET /api`: API info

### Hevy import (`/api/hevy`, `routes/hevy.js`)
Users choose which Hevy workouts to import; nothing syncs on its own. Needs a Hevy Pro API key
(hevy.com > Settings > Developer), entered in Profile > Integrations and stored encrypted.
- `GET /status`, `PUT /connection` (`{ api_key }`, checked against Hevy before saving), `DELETE /connection`
- `GET /workouts?page=&mode=all|new`: a page of Hevy workouts (10 per page, Hevy's limit), each marked
  `new`, `imported` or `changed` (edited in Hevy after import). `new` mode lists workouts changed since the last import.
- `POST /preview` (`{ workout_ids }`): the exercises those workouts use, with a suggested match
  (the user's earlier choice, else by name) and defaults for creating a new exercise
- `POST /import` (`{ workout_ids, exercises, timezone }`): each exercise maps to `{ exercise_id }`,
  `{ create: {...} }` or `{ skip: true }`. Weights are converted from kg to the user's units; RPE is
  copied only when logged. Re-importing a workout replaces its sets instead of duplicating it.

Bodyweight goes the other way. Adding, editing or deleting an entry (`/api/profile/bodyweight`)
sends that date to Hevy automatically when Hevy is connected (`services/hevyAutoSync.js`); the
response's `hevy_sync` says how it went. Hevy never blocks or fails the save: after
`HEVY_AUTO_SYNC_WAIT_MS` (default 4000) the request answers `pending` and the send finishes in the
background, and a failed date stays pending for the "Send" button (Profile > Bodyweight):
- `GET /weight`: one row per date (its latest entry; Hevy keeps one weight per date), each
  `synced`, `not_synced` or `changed` (edited here since it was sent)
- `POST /weight/sync` (`{ dates? }`): sends the given dates, or up to 60 not yet in Hevy. Hevy
  answers 409 when the date already has an entry; we then read that entry and PUT it back with only
  `weight_kg` changed, because Hevy's PUT sets any field left out to null (that would erase body fat,
  waist, etc.). Same weight already there: no write. Rate limiting or a rejected key stops the batch;
  unsent dates stay pending. Hevy's API has no delete, so deleting an entry here leaves it in Hevy.

### Cardio (`/api/cardio`, `routes/cardio.js`)
A cardio session is a `workouts` row with `kind = 'cardio'` plus a `cardio_sessions` row (sport,
indoor/outdoor, moving time, distance, elevation, cadence, and for Strava imports the route outline
and splits). Heart rate and calories live in `session_metrics`, which strength workouts use too.
- `POST /` and `PUT /:id`: log or replace a session (sport `run|ride|row|boulder|other`)
- `GET /summary?weeks=&localDate=`: weekly minutes by activity (strength included), this week, per-sport totals

### Strava sync (`/api/strava`, `routes/strava.js`, `services/strava*.js`)
Setup: create an API application at strava.com/settings/api, set its *Authorization Callback
Domain* to the app's domain (`localhost` while developing), set the three `STRAVA_*` variables, then
after deploying run `npm run strava:subscribe -- https://<domain>/api/strava/webhook` once.

- Connect: Profile > Integrations > Connect with Strava. `POST /authorize` returns the strava.com URL
  (scope `read,activity:read_all`, a signed 15-minute `state`); Strava redirects to the app's
  `/strava/callback` page, which sends the code to `POST /exchange`. Tokens are stored encrypted and
  refreshed before they expire.
- Sync (`POST /sync`, also run in the background right after connecting): new activities since the
  last sync, fetching full details (calories, description, splits) for up to `STRAVA_DETAIL_LIMIT`
  of them; then up to `STRAVA_BACKFILL_PAGES` pages (200 each) of older history, from the activity
  list only. Progress is saved per page, so hitting Strava's rate limit just means the next sync
  carries on.
- Webhook (`GET`/`POST /webhook`, no sign-in): created / updated / deleted activities arrive as they
  happen. Events aren't signed, so a delete is only applied after Strava confirms the activity is gone.
- Mapping (`services/stravaImport.js`): runs, rides, rows and climbing become cardio sessions
  (treadmill/trainer/virtual = indoor); other types become `other`. `WeightTraining` / `Crossfit`
  are matched to a strength workout here instead (start within 30 minutes of a Hevy workout's start,
  or the same day for workouts without a start time) and add their heart rate and calories to it.
  Unmatched ones wait and are matched when a workout is imported from Hevy or logged. A session
  logged by hand that matches a Strava activity is linked instead of duplicated.
- `strava_activities` records every activity seen and what happened to it. A session deleted here is
  marked `dismissed` and not imported again. Disconnecting keeps imported sessions.

### Second-by-second analysis (`services/cardioAnalysis.js`, `services/streamStore.js`)
For sessions from Strava (cardio, and lifting sessions matched to a workout) the app fetches
Strava's streams (time, distance, heart rate, speed, altitude, cadence, GPS): straight away for new
activities, and up to `STRAVA_STREAM_LIMIT` older sessions per sync (outdoor runs first), or when a
session page is opened. Streams are stored as gzipped JSON files outside the database
(`<database folder>/streams/<workout id>.json.gz`); the database keeps what's computed from them:
- `session_analysis`: a heart rate histogram (seconds per bpm), so time in zones can be worked out
  for any heart rate settings without reading the files again (`status 'none'` = no data on Strava)
- `best_efforts`: fastest 400 m, 1 km, mile, 5k, 10k, half and marathon within outdoor runs
  (treadmill distance is the watch's estimate, so it doesn't set records)
- `athlete_thresholds`: max and optional resting HR, dated. Each session uses the settings in effect
  on its date. Five zones at 50/60/70/80/90% of max HR, or of heart rate reserve with resting HR.

Endpoints (`/api/cardio`): `GET/POST /thresholds`, `DELETE /thresholds/:id`; `GET /zones?weeks=`
(weekly minutes per zone, strength and cardio); `GET /running?weeks=` (records, VDOT from the best
effort of a mile or more in the range, and 5k / 10k / half / marathon predictions by Daniels' formula);
`GET /:id/analysis` (chart series, GPS route, time in zones and best efforts for one session).

Route maps use OpenStreetMap tiles (`tile.openstreetmap.org`, with attribution), loaded by the
browser; the service worker keeps up to 400 tiles for 30 days.

## To Run:
```bash
cd backend
npm start
```

Server will start at http://localhost:3000