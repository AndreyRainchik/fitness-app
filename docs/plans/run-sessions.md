# Run session library and coaching rules

How the plan generator chooses sessions. Companion to `week-view-and-race-plans.md` (Phase 2).

The aim is to plan like a coach, not a template: every run has a purpose, sessions progress from general fitness to race-specific work, and there's enough variety that training stays engaging without losing the thread of progression.

---

## 1. Coaching principles the generator follows

1. **Mostly easy.** About 80% of weekly running time is easy (E/steady); about 20% is quality. Easy days stay easy so hard days can be hard.
2. **From general to specific.** Base builds aerobic fitness and running mechanics (strides, hills, fartlek, steady running). Build adds threshold and VO2max work. Peak turns that into race-pace work for the goal distance. Taper keeps sharpness with less volume.
3. **One change at a time.** A session family progresses by one variable per step: more reps, *or* longer reps, *or* shorter recoveries, *or* faster pace. Never all at once.
4. **Variety with a thread.** Session types rotate, but each *family* (threshold, VO2, race-pace, long run) has a progression running through the plan, so variety never means randomness.
5. **Benchmarks.** A few sessions are deliberately repeated (or a time trial is run) so the athlete can see progress, and so paces can be recalibrated.
6. **Quality volume caps** (after Daniels), per session:
   - threshold and 10K-pace work ≤ 10% of weekly distance (at least 20 min allowed, so lower-mileage runners still get a real tempo);
   - VO2max (I) work ≤ the lesser of 10 km and 8%;
   - repetition (R) work ≤ the lesser of 8 km and 5%;
   - half-marathon-pace work ≤ 25%, marathon-pace work ≤ the lesser of 20% and 18 mi / 29 km.

   Sessions are scaled to the athlete's weekly distance, so the same template is shorter for a 20 mi week than a 40 mi week. The examples below are for a typical level.
7. **A hybrid athlete has two stresses.** Lifting legs and hard running compete for the same recovery. See section 5.
8. **Explain the why.** Each session shows a one-line purpose ("Raises your lactate threshold, the pace you can hold for about an hour") and a coaching cue.

---

## 2. Pace zones

All worked out from the athlete's current VDOT (`cardioAnalysis.vdot` / `predictTime`). The example column is for VDOT 45 (about 21:50 5K, 1:40 half), per mile, rounded.

| Zone | What it is | Feels like | Example (VDOT 45) |
|---|---|---|---|
| **Recovery** | Slower end of easy | Very easy, full conversation | ~10:00+ |
| **E** Easy | Aerobic base | Conversational | 9:05–9:55 |
| **Steady** | Between easy and marathon pace | Comfortable but purposeful | ~8:25–8:45 |
| **M** Marathon pace | Predicted marathon pace | Controlled, could hold for hours | ~7:57 |
| **HM** Half marathon pace | Predicted half pace | Comfortably hard | ~7:40 |
| **T** Threshold | About 1-hour race pace | Comfortably hard, short sentences | ~7:30 |
| **10K** 10K pace | Predicted 10K pace | Hard, controlled | ~7:17 |
| **I** Interval (≈ 3K–5K pace) | VO2max | Hard, a few words only | ~6:56 (1:44 /400 m) |
| **R** Repetition (≈ mile pace) | Speed and economy | Fast and relaxed, not a sprint | ~6:28 (1:37 /400 m) |
| **Float** | Moving recovery in rolling sessions | Easy-steady, keep moving | ~M + 45 s to E |
| **Goal** | The goal race pace, if a goal time is set | | from goal time |
| **Effort** | Hills and fartlek where pace misleads | Described by feel (e.g. "hard, 5K effort") | no pace shown |

Ranges: E ±25 s/mi; steady ±10 s; M/HM/T ±3 s; 10K/I/R ±2 s; splits per rep distance are shown alongside (e.g. 800 m in 3:26–3:30).

---

## 3. The session library

Each family lists its purpose, where it fits, a typical structure and how it progresses. Warm-up (WU) for quality sessions is 1–2 mi / 2–3 km easy, plus 4 strides for VO2/R sessions; cool-down (CD) 1 mi / 1.5 km easy.

### Easy and aerobic

**Easy run**: the backbone. All phases. E pace, 30–75 min.
- *Variant, easy + strides:* finish with 4–8 × 20 s strides at about R pace with full walk-back recovery. Mechanics and leg speed at almost no fatigue cost. Twice a week in base, once a week after that.

**Recovery run**: day after a hard session or the long run, if the athlete runs that day. Recovery pace, 20–40 min. Short on purpose.

**Steady run**: aerobic strength between easy and tempo. Base and early build, and the maintenance plan. 4–8 mi / 6–13 km at steady.

**Progression run**: teaches pacing discipline and finishing strong on tired legs. All phases.
- *Thirds:* E → steady → M (base), E → M → T (build/peak).
- *Stepped:* each mile 10–15 s faster, finishing at T.
- *Fast finish:* easy, then last 10–15 min at T.

### Threshold (lactate threshold, T)

**Tempo run (continuous)**: sustained threshold. Build and peak. 15–20 min at T → 25–30 min (half/marathon plans), or broken into 2 × 10–15 min with 2 min jog.

**Cruise intervals**: more threshold time than a continuous tempo, with short recoveries. Build and peak.
- 4 × 1 mi / 1.6 km at T, 60 s jog → 5 × 1 mi → 3 × 2 mi with 90 s jog.

**Over/unders**: teaches the body to clear lactate while still running hard; great for half and 10K. Continuous, no stops.
- Alternate "over" (10K pace) and "under" (HM or M pace): 4 × (2 min over + 3 min under) → 5 × (3 min over + 2 min under) → 3 × (1 km over + 1 km under).

**Cutdown**: reps that get faster as you go, so the fastest running comes when tired. Build and peak.
- 5 × 1 km: T, T, 10K, 10K, I with 90 s jog. Or a 4-3-2-1 mile cutdown for marathoners (M → HM → T → 10K).

### VO2max and speed (I and R)

**Intervals**: raise VO2max. Build and peak, more for 5K/10K.
- 800 m: 6 × 800 m at I, 2 min jog
- 1 km: 5 × 1 km at I, 2:30 jog → 6 × 1 km
- 1200 m / mile: 4 × 1200 m, 4 × 1 mi at I/10K, 3 min jog

**Pyramid / ladder**: varied rep lengths keep a VO2 session fresh. Build.
- 400-800-1200-800-400 at I, half-rep-time jogs.
- Ladder down: 1600-1200-800-400, each rep a touch faster.

**Rolling intervals**: recoveries are run, not jogged, at float pace, so the session is continuous and builds aerobic strength alongside speed. Build and peak; a favourite for half plans.
- 6 × 3 min at 10K with 2 min float → 5 × 5 min at T with 2 min float → 8 × 2 min at I with 1 min float.

**Repetitions (R)**: speed and running economy, with full recovery so form stays good. Base and build, more for 5K.
- 8–12 × 200 m at R, 200 m walk/jog → 6–8 × 400 m at R, 400 m jog.

**Fartlek**: unstructured speed play by time and feel. Base (gentle intro to faster running) and cutback weeks.
- 8 × 1 min hard / 1 min easy → 1-2-3-2-1 min hard with half-time easy → 10 × 30 s / 90 s.

### Hills (effort-based, no pace targets)

**Hill sprints**: power and leg stiffness, injury-protective. Base. 6–10 × 10 s steep hill, walk down.
**Hill repeats**: strength-endurance. Base and early build. 8 × 60 s, then 6 × 90 s, at 5K effort, jog down.
**Long hills**: 4–5 × 3 min at 10K–HM effort. Half/marathon base.

Hills only go in a plan if the athlete has hills (see open questions). The fallback is a treadmill at 4–6% incline, or the session is swapped for repetitions.

### Race-specific

**Block run**: long blocks at goal or race pace with a float between, so the athlete gets used to goal pace. Peak.
- Half: 3 × 2 mi at HM with 0.5 mi float → 2 × 4 mi at HM with 1 mi float.
- 10K: 3 × 2 km at 10K with 2 min jog → 2 × 3 km.
- 5K: 5 × 1 km at 5K / goal with 90 s jog → 3 × 1.6 km.
- Marathon: 3 × 3 mi at M with 1 mi steady float.

**Race-pace long run**: the most race-specific session. Half/marathon peak.
- Marathon: 14 mi with 2 × 4 mi at M → 18 mi with the last 10 at M.
- Half: 12 mi with the last 4 at HM, or 3 × 2 mi at HM inside the long run.

**Tune-up / time trial**: a benchmark effort (a parkrun or a solo 5K/10K) that recalibrates paces. In cutback weeks: one in the build, one early in the peak. The result updates VDOT through the normal best-effort path.

**Sharpener**: race week. Short, crisp race-pace running without fatigue. 4–6 × 1 min at race pace with 2 min easy, plus strides.

**Shakeout**: the day before the race. 15–20 min easy with 3–4 strides.

### Long runs

The long run varies too:
- *Easy long* (base, cutback weeks)
- *Long with fast finish* (last 15–20 min at M or HM)
- *Progression long* (thirds: E → steady → M)
- *Long with surges* (6–8 × 1 min at HM effort scattered through; fartlek-style)
- *Race-pace long* (peak, half/marathon)

At most one long run in three has a quality element in base; up to every other one in peak. A long run with quality counts as one of the week's hard sessions.

---

## 4. Choosing the week's sessions

### Sessions per week by runs per week

| Runs/week | Quality sessions | Long run | Easy |
|---|---|---|---|
| 3 | 1 (rotating families) | 1, quality every 2nd–3rd week | 1 |
| 4 | 2 (one may be a steady/progression in base) | 1 | 1 |
| 5 | 2 | 1 | 2 (one with strides) |
| 6 | 2 (3 for 5K/10K peak if fitness allows) | 1 | 3 |

### What fills the two quality slots, by phase

| Phase | Slot A (speed/strength) | Slot B (threshold/specific) | Long run |
|---|---|---|---|
| Base | Fartlek, hill repeats, repetitions, strides | Progression, steady, short tempo | Easy, occasional fast finish |
| Build | Intervals, pyramids, rolling intervals | Cruise intervals, tempo, over/unders, cutdowns | Progression or fast finish |
| Peak | Race-relevant intervals (5K/10K) or rolling at T (half/M) | Block runs, over/unders, race-pace | Race-pace long (half/M) |
| Taper | Shortened intervals at race pace | Short block at goal pace | Shorter, easy, a few race-pace miles |
| Race week | Sharpener | Shakeout | Race |

### Emphasis by race

- **5K:** most VO2 and R work. Intervals in both build and peak, repetitions year-round, block runs at 5K pace. Long run up to about 25% of the week.
- **10K:** VO2 and threshold equally. Over/unders, rolling intervals, cruise intervals; blocks at 10K pace in peak.
- **Half:** threshold-led. Tempo, cruise, over/unders, rolling at T; HM-pace blocks and HM finishes on long runs in peak; VO2 once every 1–2 weeks to keep the ceiling up.
- **Marathon:** aerobic volume and M pace. Progression and steady runs, long runs with M-pace blocks, threshold for support, little VO2 work after the build.

### Variety rules

- The same session (same family *and* structure) never appears twice within 3 weeks, except benchmarks.
- Slot A and Slot B never use the same family in one week.
- Each family's progression continues where it left off when it comes back: cruise intervals go 4 × 1 mi → 5 × 1 mi → 3 × 2 mi across their appearances, not restarting.
- Cutback weeks swap one quality session for a fartlek or strides and shorten the long run; one in two cutback weeks holds a tune-up.
- If the athlete skips a session type twice (and marked it, or "How did it feel?" was 5 both times), it's used less often and the reason is noted.

### Maintenance mode

One quality session a week on a 4-week rotation: threshold (tempo/cruise/over-under) → VO2 (intervals/rolling/pyramid) → hills or repetitions → fartlek or progression. The long run alternates easy and fast-finish. Every 8 weeks, a tune-up keeps paces honest.

---

## 5. Fitting runs around lifting

- **Hill sprints, hill repeats and repetitions** load the legs neuromuscularly much like a lifting session. Never within 48 h *before* a heavy-legs day. The day after an upper-body day is ideal.
- **Threshold work** is the most forgiving: it may follow a heavy-legs day by 24 h if needed; never the day before.
- **The long run** isn't the day after heavy deadlifts if the schedule allows. If the only option is the day after squats, the long run becomes an easy long that week.
- **Matching heavy weeks:** in 5/3/1, week 3 is the heaviest lifting week and week 4 is the deload. By default, run cutback weeks line up with lifting deload weeks, so every fourth week is a true recovery week for both. The harder running weeks then avoid coinciding with week 3 where possible.
- **Load check:** if total training load (lifting included) is 1.5× usual, the next quality session becomes a steady run (see "Adapting the plan").

---

## 6. Worked example: half marathon, 12 weeks, 4 runs a week

Athlete: VDOT 45, about 22 mi/week now, lifting Mon/Wed/Fri (squat, bench, deadlift; OHP on Sat), runs Tue/Thu/Sat/Sun. Cutback weeks 4 and 8 line up with the 5/3/1 deload.

| Wk | Phase | Tue (Slot A) | Thu (Slot B) | Sun (long) | ~mi |
|---|---|---|---|---|---|
| 1 | Base | Fartlek 8 × 1 min / 1 min | Progression 5 mi (E → steady → M) | 7 mi easy | 22 |
| 2 | Base | Hill repeats 8 × 60 s | Tempo 2 × 10 min T / 2 min | 8 mi easy | 24 |
| 3 | Base | Rolling 6 × 3 min 10K / 2 min float | Steady 5 mi | 9 mi, last 2 steady | 26 |
| 4 | Cutback | Repetitions 8 × 200 m R | **5K time trial** (benchmark) | 7 mi easy | 21 |
| 5 | Build | Intervals 3 × 1200 m I / 3 min | Cruise 3 × 1 mi T / 60 s | 10 mi easy | 28 |
| 6 | Build | Pyramid 400-800-1200-800-400 | Over/unders 4 × (3 min 10K + 3 min HM) | 10 mi progression | 30 |
| 7 | Build | Cutdown 5 × 1 km T → I | Block 3 × 2 mi HM / 0.5 mi float | 11 mi, last 15 min HM | 32 |
| 8 | Cutback | Fartlek 1-2-3-2-1 | **Tune-up:** 10K effort or 5K | 8 mi easy | 25 |
| 9 | Peak | Mile repeats 3 × 1 mi 10K / 2 min | Over/unders 5 × (3 min 10K + 2 min HM) | 12 mi with 2 × 3 mi HM | 33 |
| 10 | Peak | Rolling 5 × 5 min T / 2 min float | Block 2 × 4 mi HM / 1 mi float | 12 mi fast finish | 34 |
| 11 | Taper | Intervals 4 × 800 m I | Tempo 3 mi at HM | 9 mi easy, 2 mi HM | 26 |
| 12 | Race | Sharpener 5 × 1 min HM + strides | Shakeout 2 mi (Sat) | **Race (Sun)** | 20 |

Every session is within the caps for that week's distance (e.g. week 5: 3.6 km of I work against a 2.2 mi / 3.6 km cap). Each week's Saturday is an easy run (with strides in weeks 1–3 and 5–7). That's 15 different session types, with three clear threads: threshold (tempo → cruise → over/unders → HM blocks), VO2 (rolling → intervals → pyramid → mile repeats), and the long run (easy → fast finish → progression → HM-pace).

Lifting check: no Tuesday session falls the day before a heavy-legs day here, since Wednesday is bench. Thursday's session is the day before Friday's deadlift, so it's always a threshold-family session, never hills or repetitions. If the athlete's lift order put deadlifts on Wednesday, the generator would swap Slot A and B.

---

## 7. How this is stored

Session families are data, not code: `backend/src/services/runSessions.js` exports templates such as

```js
{
  id: 'over_unders',
  family: 'threshold',
  name: 'Over/unders',
  purpose: 'Teaches your body to clear lactate while still running hard.',
  cue: 'Stay relaxed on the unders; they are not recovery.',
  phases: ['build', 'peak'],
  races: { '5k': 1, '10k': 3, half: 3, marathon: 1 },   // weighting
  legStress: 'medium',                                    // for the lifting rules
  levels: [                                               // progression, one variable at a time
    { reps: 4, steps: [{ min: 2, zone: '10K' }, { min: 3, zone: 'HM' }] },
    { reps: 5, steps: [{ min: 3, zone: '10K' }, { min: 2, zone: 'HM' }] },
    { reps: 3, steps: [{ km: 1, zone: '10K' }, { km: 1, zone: 'HM' }] },
  ],
}
```

The generator picks a family per slot (phase, race weighting, variety rules, lifting constraints), takes the next level in that family's progression, and scales it to the week's distance within the volume caps. Adding a new session type means adding a template, with tests checking it stays within the caps.
