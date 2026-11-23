# Week view and race training plans

**Status:** Phase 1 built; Phase 2 step 1 (plans on My Week) built 2026-11-23; step 2 (following) next · **Decided:** 2026-11-23

## What we're building

1. **One week view** that shows lifting and cardio together: what's planned for each day and what was done.
2. **Run plans generated in the app**, placed around a fixed lifting schedule: race plans for 5K, 10K, half marathon and marathon, and a maintenance plan between races. They adapt to what you actually run. This replaces Runna.

## Decisions so far

| Question | Answer | What it means for the design |
|---|---|---|
| Lifting days | Fixed weekdays | The user picks lifting days once (e.g. Mon/Wed/Fri); program lifts fill them in order |
| Workouts on the watch | Viewing in the app is fine | No Garmin/Apple export. Workouts appear in the app; Strava sync marks them done |
| Race distances | 5K, 10K, half, marathon | Four plan templates; ultra/trail is out of scope |
| Lifting during a plan | Plan runs around lifting | The lifting program stays the same; hard runs avoid the day before heavy legs; lifting volume is reduced in race week |
| How Runna was used | Set plans **and** its adjustments | Adapting the plan is core, not an extra (see "Adapting the plan") |
| Structured intervals | Yes | Interval runs have warm-up / reps / recoveries / cool-down, and reps are checked one by one |
| Between races | A maintenance mode | Rolling plan with no race date; a race plan hands over to it when it ends |
| Pace or heart rate | Pace | Targets are pace ranges; heart rate only as a secondary easy-run cap |
| Deterministic or AI-generated plans | **Deterministic** (decided); optional AI coach later | The rules engine builds and adapts every plan. An optional bring-your-own-key AI coach (Phase 4) can only propose changes through the engine, which checks them against the same rules |

---

## Phase 1: Week view and weekly schedule ✅

> **As built.** `/week` ("My Week"), `GET /api/week`, `services/weekPlan.js`, tests in `npm run test:week`.
> Changes from the plan below:
> - Slots are **Lift / Cardio / Both / Rest / Flexible** (not "Run"), since cardio covers rides, rows and climbing too.
> - Program lifts are a **queue**, not pinned to weekdays: upcoming lifting days take the next lifts not done yet, so a missed day pushes its lift to the next lifting day. A lift counts as done when it's marked in Program Week *or* a workout since the program week began contains it. "Complete week" now records the date (`programs.week_started_on`) so lifts from the previous week don't count twice.
> - Moving a session is done by changing **what a date is for** (e.g. Wednesday → rest, Thursday → lift), not by dragging an item. The queue follows. Stored in `schedule_overrides`.
> - "Start" on today's lifts opens Program Week, which already builds the workout with plate-rounded weights. No second copy of that logic.
> - Planned cardio is a generic "Cardio" item until Phase 2 fills it with race-plan runs, so no `planned_sessions` table yet.
> - Weeks run Sunday–Saturday like the rest of the app; the schedule editor lists Monday first.

### Weekly schedule (Profile or Programs → "My week")
- One row per weekday: **Lift**, **Run**, **Both**, **Rest**, or **Flexible**.
- The active program's lifts fill the lifting days in order:
  - 5/3/1 (4 lifts): Mon OHP, Wed Deadlift, Fri Bench, Sat Squat, for example
  - Starting Strength: A/B/A, then B/A/B
- Mark which lifts are **heavy legs** (squat and deadlift by default). The race plan uses this.

### The week page (replaces or extends "This Week")
- Mon–Sun columns on desktop and one row per day on mobile. Earlier and later weeks are one swipe or click away.
- Each day shows:
  - **Planned items:** a program lift ("Squat — 5/3/1 week 2, 3×3 @ 85%") or a planned run ("Tempo 6 mi, 4 mi @ 7:05/mi")
  - **Completed sessions** from History (logged, Hevy or Strava), with duration, distance and HR
  - Status: ✅ done · ⏭ skipped · ⚠ missed · ○ upcoming
- **Matching:** a session on the same day and of the same kind marks the planned item done. For a run, the closest distance wins. A lift needs a workout that contains that exercise. Items can be dragged to another day (override for that week only) or marked skipped.
- **Week summary bar:** lifting sessions done of planned, run distance done of planned, training load vs the 4-week average, and form.
- "Start workout" on a planned lift opens the same pre-filled Active Workout that This Week opens today.

### Data model
```sql
weekly_schedule (user_id, weekday 0-6, slot TEXT CHECK(slot IN ('lift','run','both','rest','flex')))
planned_sessions (
  id, user_id, date, kind ('strength'|'cardio'),
  source ('program'|'race_plan'|'manual'), source_id,
  title, details_json,            -- lift + sets, or run structure + paces
  status ('planned'|'done'|'skipped'),
  workout_id NULL                  -- the completed session matched to it
)
```
Program lifts are **computed** from the schedule and program state, not stored, so they stay in step when a 5/3/1 week advances. Overrides (moved or skipped) are stored as `planned_sessions` rows. Race-plan runs are stored, since the plan is generated once and then adjusted.

### API
- `GET/PUT /api/schedule`: weekday slots and heavy-leg lifts
- `GET /api/week?start=YYYY-MM-DD`: planned and done items per day, matches and the summary
- `PATCH /api/planned/:id`: move, skip, or link to a workout by hand

---

## Phase 2: Run plans (race and maintenance)

### Inputs (a "New race plan" wizard)
- Race: distance, date, name; optional goal time
- **Current fitness:** VDOT from best efforts in the past 90 days, which the app already calculates. The user can override it with a recent race result.
- **Current volume:** average weekly distance and longest run over the past 4 weeks, from History
- Runs per week (3–6), preferred long-run day; the run days come from the weekly schedule

### Plan length and phases
| Race | Default length | Base | Build | Peak | Taper |
|---|---|---|---|---|---|
| 5K | 8 wk | 2 | 3 | 2 | 1 |
| 10K | 10 wk | 3 | 3 | 3 | 1 |
| Half | 12 wk | 3 | 4 | 3 | 2 |
| Marathon | 16–18 wk | 4 | 5 | 4–6 | 3 |

If the race is closer than the default length, the base phase is cut first. Too little time gets a warning.

### Volume rules
- Weekly distance starts at the current 4-week average and **grows by ≤10% per week**
- Every 4th week is a **cutback** to about 80%
- The long run is 25–30% of the week (marathon up to about 35%), with a cap: 22 mi / 35 km for a marathon, 13 mi / 21 km for a half
- Taper: −20–30% per week, with intensity kept

### Session types and paces (Daniels' zones from VDOT)

> The full session library, pace zones and selection rules are in [`run-sessions.md`](run-sessions.md); the table below is the short version.

| Type | Pace | Used for |
|---|---|---|
| Easy / recovery | E pace | Most runs |
| Long | E pace, marathon plans add M-pace segments in the peak phase | Endurance |
| Tempo / threshold | T pace, 20–40 min continuous or cruise intervals | Base → peak |
| Intervals | I pace, e.g. 5×1000 m, 6×800 m | Build/peak, mostly 5K/10K |
| Repetitions / strides | R pace, short reps | 5K/10K, plus strides on easy days |
| Race pace | Goal pace | Peak phase, half/marathon |

We work out the E/M/T/I/R paces from the VDOT formula we already have, rather than copying a published table. When a run sets a new best effort and the VDOT rises, **upcoming paces update**. The user is told; nothing changes silently.

A **goal time** sets the race pace and is checked against current VDOT: "your 5K VDOT predicts 1:38; 1:30 is ambitious." Training paces still come from current fitness.

### Structured workouts
Each run is a list of steps, so intervals are fully specified:

```
Intervals: 6 × 800 m
  Warm-up      1.5 mi easy (9:10–9:50 /mi)
  6 ×  800 m   at 3:24–3:28 (6:51–6:59 /mi)
       recover 2:00 jog
  Cool-down    1 mi easy
```

- Step kinds: warm-up, work, recovery (jog or stand, by time or distance), cool-down, plus strides (e.g. 6 × 20 s).
- Rep sets follow a progression across the build/peak phases, e.g. for a 10K: 5 × 1 km → 6 × 1 km → 4 × 1.6 km → 3 × 2 km at I pace; cruise intervals 3 × 1.6 km → 4 × 1.6 km → 2 × 3.2 km at T pace; half/marathon race-pace blocks inside long runs.
- Total and work distance are worked out, so weekly distance stays accurate.

### Pace targets
- Every step shows a **pace range** in the user's unit (/mi or /km), e.g. tempo 7:27–7:33 /mi. Reps show the target **split** for the rep distance as well (800 m in 3:24–3:28), since that's what you read off a watch.
- Easy and long runs get a wide range and the note that slower is fine; an optional heart-rate cap (top of zone 2) is shown in small print, since easy days are where pace misleads (heat, hills, fatigue).
- Treadmill runs also show speed (mph or km/h).

### Placement around lifting
- At most **2 hard runs** (tempo, intervals, race pace) per week, 3 for 5K/10K at 5+ runs a week
- **No hard run the day before a heavy-legs day**, and preferably not the day after
- The long run never falls the day before heavy legs; same-day lifting and long run is allowed only on "Both" days
- Two hard days never run back to back
- If a rule can't be met with the chosen days, the plan picks the least bad option and shows **why**, e.g. "Tuesday's intervals come before Wednesday's deadlifts; consider moving deadlifts to Thursday"
- Race week: the planner suggests skipping or lightening the last heavy-legs session (planner only; the program isn't changed)

### Following the plan
- A run synced from Strava (or logged) is matched to the planned run that day: the closest distance wins; if nothing was planned that day, a planned run from the day before or after.
- **After each run:** distance done vs planned, and for structured runs a **rep-by-rep table**: each work rep's time and pace against its target, marked on target / fast / slow (±2%). Reps are found in the second-by-second data by looking for the planned number of fastest non-overlapping stretches of the rep distance, in order, so no lap button is needed. Where there's no stream (treadmill without a footpod, manual log), only distance and average pace are checked.
- An optional **"How did it feel?"** (1–5, easy to very hard) after a run, which feeds the adjustments below.

### Adapting the plan
Two kinds of change. Small, safe ones happen by themselves and are listed in a "Plan changes" note on the week. Bigger ones are a suggestion with one tap to accept, showing what changes.

| What happened | What the plan does | How |
|---|---|---|
| Missed an easy run | Drops it | Automatic |
| Missed a key run (long, tempo, intervals, race pace) | Moves it to a free day later this week if the lifting rules allow, else drops it and keeps the week's other key run | Suggested |
| Lifting day moved (via a date change) | Re-places this week's runs so the rules still hold | Automatic |
| New best effort raises fitness | New paces for upcoming runs ("tempo 7:30 → 7:24") | Suggested |
| Reps on target and felt ≤ 3, two key runs in a row | Paces up one step (about +0.5 VDOT) | Suggested |
| Reps more than 3% slow, or felt 5, two key runs in a row | Paces down one step | Suggested |
| A week under 70% of planned distance | Next week repeats it instead of adding distance | Automatic |
| Two such weeks, or 10+ days without running | Rebuilds the rest of the plan from current distance; warns if the goal time is now out of reach | Suggested |
| Training load 1.5× the usual (lifting included) | Turns the next hard run into an easy one | Suggested |
| Race date or runs per week changed | Rebuilds from today | On request |

Nothing in the past is rewritten: changes apply from today on, and each one is recorded with its reason.

### Maintenance mode
For the weeks between races. No race date; it rolls on in 4-week blocks.
- **Distance:** holds a weekly target (default: the last 4 weeks' average, or 70% of the race plan's peak when it follows one), with an easier fourth week.
- **One quality run a week** rotating through tempo, intervals and hills or strides, plus a long run of about 25–30% of the week; the rest easy.
- Paces follow fitness the same way, so a maintenance block keeps them current for the next race.
- **Handover:** after a race, 1–2 recovery weeks of easy running, then maintenance. Starting a race plan from maintenance uses the maintenance distance as its starting point.

### Data model
```sql
run_plans (id, user_id, kind ('race'|'maintenance'), status ('active'|'done'|'cancelled'),
           race_name NULL, distance_m NULL, race_date NULL, goal_s NULL,
           vdot, weekly_target_m, runs_per_week, long_run_weekday,
           created_at, ended_at NULL)
planned_runs (id, plan_id, date, type ('easy'|'long'|'tempo'|'intervals'|'reps'|'race_pace'|'race'),
              title, steps_json, distance_m, key (0/1),
              status ('planned'|'done'|'skipped'|'moved'), workout_id NULL, feel NULL,
              compliance_json NULL)      -- rep results once matched
plan_changes (id, plan_id, created_at, kind, reason, status ('applied'|'suggested'|'accepted'|'dismissed'), diff_json)
```
`steps_json`: `[{ kind: 'warmup'|'work'|'recovery'|'cooldown'|'strides', reps?, distance_m? | duration_s?, zone: 'E'|'M'|'T'|'I'|'R'|'race' }]`. Paces are not stored per run: they're worked out from the plan's current VDOT when shown, so a pace change is one number.

### Generator
Pure functions in `backend/src/services/runPlan.js`:
- `generatePlan({ kind, race, vdot, baseline, runsPerWeek, schedule, liftQueue, startDate }) → weeks[]`
- `placeWeek(runs, days, heavyLegDates)` → the week's runs on dates, plus any rule it couldn't keep and why
- `paces(vdot)` → E/M/T/I/R pace ranges
- `matchReps(stream, steps)` → per-rep results
- `adjust(plan, history, today)` → changes to apply or suggest

All deterministic and unit-tested: weekly growth ≤10%, no hard run before heavy legs, taper shape, paces against Daniels' tables, rep detection on synthetic streams.

### Build order
1. ✅ **Plans and the week:** wizard, generator, paces, structured runs shown on My Week in place of the generic "Cardio" (race and maintenance).
2. **Following:** matching runs, rep-by-rep results, "How did it feel?".
3. **Adapting:** the rules in the table, the "Plan changes" note and one-tap suggestions.
4. **Race and after:** race week, recovery weeks, handover to maintenance.

---

## Phase 3 (later)
- Strength/run balance on the week view: warn when the week's load is 1.5× the usual (form data already exists)
- Race-day page: pacing plan by mile/km, goal and predicted time
- Post-race review: result vs prediction, VDOT update
- Optional: download a `.FIT` workout file per run for Garmin

## Phase 4 (optional): AI coach, bring your own key
The plan never depends on it: without a key, everything above works the same.
- The user adds an API key for an AI provider in Profile > Integrations, stored encrypted like the Hevy key, with a clear note on what data is sent (runs, paces, the plan, their notes).
- **Talk to the plan:** "I'm away 12–15 March", "my calf is tight", "can I swap Thursday's session, I'm tired". The model answers through a fixed set of tools that map to the engine's own operations (move a run, swap a session for another from the library, mark days unavailable, change the race date, ease the next N days). Tool inputs use strict schemas.
- The engine validates every proposed change against the same rules (ramp, caps, lifting placement). Changes that pass are shown as suggestions with one tap to accept. The model never writes paces or distances itself.
- **Weekly review in words:** a short coach-style summary of the week from the engine's numbers (what went well, what to focus on).
- **Session evaluations, for every session, not just runs:** after a run, a lifting workout, a ride or a climbing session, a short evaluation from the session's data and its plan. For example rep splits against targets, AMRAP reps against the 5/3/1 target, RPE drift across sets, heart rate against effort, and how the session fits the week's load. Read-only commentary; any change it suggests goes through the engine like the rest.

## Out of scope for now
- Pushing workouts to a watch
- Ultra and trail plans
- Changing the lifting program automatically during a plan
