# Feature Tracker

A living list of what the app does today and what we might build next.
`PROGRESS-SUMMARY.md` stops at v2.0 (Nov 2025); this file covers everything since.

**Last reviewed:** 2026-11-23 (after #28)

Legend for the backlog: **Impact** H/M/L for a hybrid strength + cardio athlete · **Effort** S (days) / M (a week or two) / L (multi-week) · ⚡ = builds mostly on data we already store.

---

## ✅ Shipped

### Strength logging
- Live workout with workout timer and rest timer (background-safe, sound at the end, skip)
- One shared editor for New, Active and Edit workout; saves in a single request
- Sets with weight, reps, RPE (half steps), warm-up sets, assisted (negative) weights
- Superset support in the editor
- "Last time" performance shown per exercise
- In-progress workout survives refreshes; warning before leaving
- Exercise library (60+) with search/autocomplete, muscle group and equipment
- Templates: create from a workout, edit, start a workout from one
- Plate calculator with a plate inventory and saved presets; weights rounded to loadable plates

### Programs
- 5/3/1 Boring But Big: 4-week cycles, AMRAP tracking, BBB 5×10, deload, training-max choices at cycle end, double increment for 10+ rep AMRAPs in week 3, per-lift override
- Starting Strength: A/B alternation, linear progression, next-session preview
- Lift statuses (completed / failed), failed-lift handling, warm-ups added to program workouts
- "This Week" page that starts a pre-filled workout per lift
- GZCLP and nSuns listed as "coming soon"

### Cardio
- Manual logging: run, ride, row, bouldering, other; indoor/outdoor; distance, time, elevation, cadence, HR, calories
- Mixed History (strength + cardio) with activity filter and search kept in the URL
- Session pages: route map (OpenStreetMap/Leaflet), HR / pace / elevation charts with shared hover, splits, time in zones, best efforts
- Heart-rate settings dated over time (% max HR or heart-rate reserve), max-HR suggestion

### Integrations
- **Strava:** OAuth, encrypted tokens, background history sync, webhook for create/update/delete, second-by-second streams, de-duplication with hand-logged runs, lifting sessions matched to Strava for HR/calories/duration
- **Hevy:** workout import with per-workout choice and exercise mapping, re-import replaces rather than duplicates; bodyweight sent to Hevy automatically (keeping its other measurements); dashboard offers the latest Hevy workout

### Analytics
- Estimated 1RM (Brzycki/Epley mix), lift progression charts, PRs
- Strength score, percentiles and strength standards (Wilks-based)
- Muscle balance / symmetry with body map, push/pull/legs split, weekly muscle heatmap
- Endurance: weekly time by activity, weekly time in zones (cardio + lifting), running records 400 m → marathon, VDOT race predictions
- Training load (TRIMP from HR, else RPE × time, else an estimate); fitness / fatigue / form chart with overreaching warning
- Dashboard: stats, streak, activity heatmap, weekly volume, insights tabs (strength trend, fitness & form)

### Profile & platform
- Account, units, sex, password/email change; bodyweight log with chart
- Light/dark theme, mobile-first UI with bottom bar, installable PWA (map tiles cached)
- Lazy-loaded pages, gzip, correct caching; Docker/Podman, Cloud Run deploy via GitHub Actions

---

## 💡 Backlog / brainstorm

### Tier 1: biggest gap for a hybrid athlete

| Idea | Why it matters | Impact | Effort |
|---|---|---|---|
| **Weekly plan / calendar** that puts program lifts *and* cardio sessions on days | Hybrid athletes juggle both; today "This Week" only knows lifting | H | M |
| **Interference guard**: flag hard intervals or long runs within ~24h before heavy legs (and vice versa) | The main problem of concurrent training | H | S ⚡ |
| **Daily readiness check-in** (sleep, soreness, stress, mood, 1–5) shown next to form, with a suggestion like "go lighter today" | Combines how you feel with the fitness/fatigue model | H | S |
| **Goals with progress bars**: "405 deadlift", "sub-20 5K", "150 mi this month" | Motivation; VDOT and e1RM already give the projection | H | S ⚡ |
| **Weekly review**: one screen with volume per muscle group, cardio time, load vs last 4 weeks, new PRs | Turns many charts into one takeaway | H | S ⚡ |
| **Data export** (CSV/JSON of workouts, sets, cardio, bodyweight) | Trust and ownership; listed as a gap since v2 | M | S |

### Tier 2: strength depth

| Idea | Impact | Effort |
|---|---|---|
| **GZCLP and nSuns** (placeholders already exist), then a **custom program builder** | H | M–L |
| **Autoregulation**: suggest the next set's weight from RPE/RIR (e.g. RPE 9 ⇒ hold, RPE 7 ⇒ +2.5%) | H | S ⚡ |
| **Weekly sets per muscle group vs targets** (MEV/MAV-style ranges) | M | S ⚡ |
| **Auto-deload suggestion** when e1RM stalls 3+ weeks or form stays in "overreaching" | M | S ⚡ |
| **Set types**: drop sets, rest-pause, AMRAP, failure as real fields (Hevy notes already carry them) | M | S |
| **Exercise-specific rest defaults** (3 min squat, 90 s curls) | M | S |
| **Bar-speed / tempo / time-under-tension** fields | L | M |
| **Exercise demo notes and cues**, custom exercises with personal notes | M | S |

### Tier 3: cardio depth

| Idea | Impact | Effort |
|---|---|---|
| **Structured interval workouts** (6×800 @ 5K pace) with paces from VDOT | H | M |
| **Polarisation check**: % of weekly time in Z1–2 vs Z4–5 (80/20 target) | M | S ⚡ |
| **Weekly mileage ramp warning** (>10% jump) and **shoe mileage** | M | S ⚡ |
| **Running power, FTP and power zones for rides** (Strava streams can include watts) | M | M |
| **Aerobic decoupling / efficiency factor** (pace per heartbeat over time) | M | S ⚡ |
| **More sports**: swim, hike, ski, elliptical, stairs; **conditioning** (EMOM, AMRAP, sled, assault bike) | M | S–M |
| **Race calendar** with taper planning and a countdown | M | M |

### Tier 4: body, recovery and health

| Idea | Impact | Effort |
|---|---|---|
| **Body measurements and body fat %** (and send them to Hevy too) | M | S |
| **Progress photos** (private, side-by-side) | M | M |
| **Resting HR / HRV / sleep** from Apple Health, Garmin, Whoop or Oura | H | L |
| **Nutrition basics**: protein and calories per day, bodyweight trend vs target | M | M |
| **Injury / pain log** that marks affected exercises and shows recurring patterns | M | S |
| **Mobility / stretching sessions** as their own type | L | S |

### Tier 5: experience and polish

| Idea | Impact | Effort |
|---|---|---|
| **Offline logging** with sync later (gyms with bad signal) | H | M |
| **Rest-timer notifications / vibration** while the screen is locked | H | S |
| **Year in review / milestones** (1M lb lifted, 1,000 km run, badges) | M | S ⚡ |
| **Plate-loading order** and a warm-up generator for any lift | M | S |
| **Share card** image for a PR or a run | L | S |
| **Apple Watch / Wear OS companion**, voice set entry | M | L |
| **Tests** for the strength maths and API (see v2 notes) | M | M |

---

## 🗳️ Decisions

Record ideas we pick, defer or drop here, with a one-line reason.

| Date | Idea | Decision | Notes |
|---|---|---|---|
| 2026-11-23 | Weekly plan / calendar for lifting + cardio | ✅ Picked (Phase 1) | Several lifts and runs each week; fixed lifting weekdays. Design: `docs/plans/week-view-and-race-plans.md` |
| 2026-11-23 | Race training plans generated in the app (replace Runna) | ✅ Picked (Phase 2) | 5K, 10K, half, marathon; paces from VDOT; runs placed around lifting |
| 2026-11-23 | Interference guard | ✅ Folded into Phase 2 | No hard run the day before heavy legs |
| 2026-11-23 | Push structured workouts to a watch | ⏸ Deferred | Viewing in the app is enough; Strava sync marks runs done |
| 2026-11-23 | Ultra / trail plans | ⏸ Deferred | Not a current race distance |
