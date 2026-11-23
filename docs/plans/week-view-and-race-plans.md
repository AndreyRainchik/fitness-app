# Week view and race training plans

**Status:** Phase 1 built (2026-11-23); Phase 2 next · **Decided:** 2026-11-23

## What we're building

1. **One week view** that shows lifting and cardio together: what's planned for each day and what was done.
2. **Race plans generated in the app** for 5K, 10K, half marathon and marathon, placed around a fixed lifting schedule. This replaces Runna for planning.

## Decisions so far

| Question | Answer | What it means for the design |
|---|---|---|
| Lifting days | Fixed weekdays | The user picks lifting days once (e.g. Mon/Wed/Fri); program lifts fill them in order |
| Workouts on the watch | Viewing in the app is fine | No Garmin/Apple export. Workouts appear in the app; Strava sync marks them done |
| Race distances | 5K, 10K, half, marathon | Four plan templates; ultra/trail is out of scope |
| Lifting during a plan | Plan runs around lifting | The lifting program stays the same; hard runs avoid the day before heavy legs; lifting volume is reduced in race week |

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

## Phase 2: Race plan generator

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

### Placement around lifting
- At most **2 hard runs** (tempo, intervals, race pace) per week, 3 for 5K/10K at 5+ runs a week
- **No hard run the day before a heavy-legs day**, and preferably not the day after
- The long run never falls the day before heavy legs; same-day lifting and long run is allowed only on "Both" days
- Two hard days never run back to back
- If a rule can't be met with the chosen days, the plan picks the least bad option and shows **why**, e.g. "Tuesday's intervals come before Wednesday's deadlifts; consider moving deadlifts to Thursday"
- Race week: the planner suggests skipping or lightening the last heavy-legs session (planner only; the program isn't changed)

### Following the plan
- A run synced from Strava is matched to the planned run on that day (closest distance; ±1 day if nothing was planned on the day)
- After each run, **compliance** is shown: distance done vs planned, and for structured runs, average pace in the work reps vs target (from Strava streams and splits)
- **Missed run:** the week isn't rebuilt by default. If a key session (long run or hard run) is missed, offer to move it to another free day this week
- **Plan check:** if 2 or more weeks fall under 70% of planned volume, offer to rebuild from today with the current volume

### Data model
```sql
race_plans (id, user_id, race_name, distance_m, race_date, goal_s NULL,
            vdot_at_start, runs_per_week, long_run_weekday, status, created_at)
-- runs are planned_sessions rows with source = 'race_plan'; details_json holds
-- { type, distance_m, segments: [{ reps, distance_m | duration_s, pace_zone, rest_s }] }
```

### Generator
A pure function in `backend/src/services/racePlan.js`:
`generatePlan({ race, vdot, baseline, runsPerWeek, schedule, heavyLegDays, startDate }) → weeks[]`.
It's deterministic and easy to unit-test (weekly growth ≤10%, no hard run before heavy legs, taper shape, paces against VDOT).

---

## Phase 3 (later)
- Strength/run balance on the week view: warn when the week's load is 1.5× the usual (form data already exists)
- Race-day page: pacing plan by mile/km, goal and predicted time
- Post-race review: result vs prediction, VDOT update, recovery weeks offered
- Optional: download a `.FIT` workout file per run for Garmin

## Out of scope for now
- Pushing workouts to a watch
- Ultra and trail plans
- Changing the lifting program automatically during a plan
