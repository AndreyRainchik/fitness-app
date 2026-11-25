import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;
let SQL = null;

/** Where the database file lives (DATABASE_PATH, else backend/fitness.db). */
export function databasePath() {
  return process.env.DATABASE_PATH || path.join(__dirname, '../../', 'fitness.db');
}

/**
 * Initialize the SQLite database
 */
export async function initDatabase() {
  try {
    // Initialize sql.js
    SQL = await initSqlJs();
    
    const dbPath = databasePath();

    // Check if database file exists
    if (fs.existsSync(dbPath)) {
      console.log('📂 Loading existing database...');
      logger.info(`🔄 Loading database from ${dbPath}`);
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
      // Run migrations for existing databases
      try {
        db.run('ALTER TABLE program_lift_status ADD COLUMN amrap_reps INTEGER');
        console.log('✅ Migration: added amrap_reps column to program_lift_status');
        saveDatabase();
      } catch (e) {
        // Column already exists, ignore
      }
      ensureHevySchema();
      ensureCardioSchema();
      ensureStravaSchema();
      ensureAnalysisSchema();
      ensureProgramSchema();
      ensureAuthSchema();
      ensureExerciseOwnerSchema();
      splitBackMuscleGroup();
      enableForeignKeys();
      saveDatabase();
    } else {
      console.log('🆕 Creating new database...');
      db = new SQL.Database();
      createTables();
      ensureHevySchema();
      ensureCardioSchema();
      ensureStravaSchema();
      ensureAnalysisSchema();
      ensureProgramSchema();
      ensureAuthSchema();
      ensureExerciseOwnerSchema();
      seedExercises();
      enableForeignKeys();
      saveDatabase();
    }
    
    console.log('✅ Database initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

/**
 * Create all database tables
 */
function createTables() {
  console.log('📋 Creating tables...');
  
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      username TEXT NOT NULL,
      bodyweight REAL,
      units TEXT DEFAULT 'kg' CHECK(units IN ('kg', 'lbs')),
      sex TEXT CHECK(sex IN ('M', 'F')),
      plate_inventory TEXT,
      bar_weight REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bodyweight logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS bodyweight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date DATE NOT NULL,
      weight REAL NOT NULL,
      units TEXT DEFAULT 'lbs' CHECK(units IN ('kg', 'lbs')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  
  // Exercises table
  db.run(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT CHECK(category IN ('barbell', 'dumbbell', 'machine', 'bodyweight', 'cable', 'other')),
      primary_muscle_group TEXT NOT NULL,
      secondary_muscle_groups TEXT,
      is_compound INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Workouts table
  db.run(`
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date DATE NOT NULL,
      name TEXT,
      notes TEXT,
      duration_minutes INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  
  // Sets table
  db.run(`
    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      set_number INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight REAL NOT NULL,
      rpe REAL,
      is_warmup INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    )
  `);
  
  // Programs table
  db.run(`
    CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('531', 'starting_strength', 'custom')),
      start_date DATE NOT NULL,
      current_week INTEGER DEFAULT 1,
      current_cycle INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  
  // Program lifts table
  db.run(`
    CREATE TABLE IF NOT EXISTS program_lifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      training_max REAL NOT NULL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    )
  `);
  
  // Workout templates table
  db.run(`
    CREATE TABLE IF NOT EXISTS workout_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  
  // Template sets table (mirrors sets table but for templates)
  db.run(`
    CREATE TABLE IF NOT EXISTS template_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      set_number INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight REAL NOT NULL,
      rpe REAL,
      is_warmup INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    )
  `);

  //Plate inventory presets table
  db.run(`
    CREATE TABLE IF NOT EXISTS plate_inventory_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      plates TEXT NOT NULL, -- JSON: {"45": 4, "25": 2, "10": 4, etc.}
      bar_weight REAL NOT NULL DEFAULT 45,
      is_active INTEGER DEFAULT 0, -- 0 or 1, only one preset can be active per user
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name) -- Each user's preset names must be unique
    )
  `);

  // Program lift status table
  db.run(`
        CREATE TABLE IF NOT EXISTS program_lift_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          program_id INTEGER NOT NULL,
          exercise_id INTEGER NOT NULL,
          week INTEGER NOT NULL,
          cycle INTEGER NOT NULL,
          status TEXT CHECK(status IN ('completed', 'failed', 'skipped')) NOT NULL,
          notes TEXT,
          amrap_reps INTEGER,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
          FOREIGN KEY (exercise_id) REFERENCES exercises(id),
          UNIQUE(program_id, exercise_id, week, cycle)
        )
  `);
  
  // Create indexes for better query performance
  db.run('CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sets_workout ON sets(workout_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets(exercise_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_bodyweight_user_date ON bodyweight_logs(user_id, date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_templates_user ON workout_templates(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_template_sets_template ON template_sets(template_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_plate_presets_user_id ON plate_inventory_presets(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_plate_presets_active ON plate_inventory_presets(user_id, is_active)');
  db.run(`CREATE INDEX IF NOT EXISTS idx_program_lift_status_program ON program_lift_status(program_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_program_lift_status_week_cycle ON program_lift_status(program_id, week, cycle)`);
  
  console.log('✅ Tables created successfully');
}

/**
 * Tables and columns for importing workouts from Hevy. Safe to run on every
 * start: each step is skipped when it has already been applied.
 */
function ensureHevySchema() {
  // Which Hevy workout a workout was imported from, and the Hevy updated_at
  // it was imported at (to spot workouts edited in Hevy since the import)
  for (const column of ['hevy_workout_id TEXT', 'hevy_updated_at TEXT']) {
    try {
      db.run(`ALTER TABLE workouts ADD COLUMN ${column}`);
    } catch (e) {
      // Column already exists
    }
  }
  db.run('CREATE INDEX IF NOT EXISTS idx_workouts_user_hevy ON workouts(user_id, hevy_workout_id)');

  // One Hevy connection per user. The API key is stored encrypted.
  db.run(`
    CREATE TABLE IF NOT EXISTS hevy_connections (
      user_id INTEGER PRIMARY KEY,
      api_key_encrypted TEXT NOT NULL,
      key_hint TEXT,
      hevy_username TEXT,
      last_synced_at TEXT,
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // The user's choice of exercise for each Hevy exercise template, so each
  // Hevy exercise only has to be matched once
  db.run(`
    CREATE TABLE IF NOT EXISTS hevy_exercise_mappings (
      user_id INTEGER NOT NULL,
      hevy_template_id TEXT NOT NULL,
      hevy_title TEXT,
      exercise_id INTEGER NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, hevy_template_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    )
  `);

  // The bodyweight last sent to Hevy for each date (Hevy keeps one per date),
  // to tell which dates still need sending
  db.run(`
    CREATE TABLE IF NOT EXISTS hevy_weight_syncs (
      user_id INTEGER NOT NULL,
      date DATE NOT NULL,
      weight_kg REAL NOT NULL,
      synced_at TEXT NOT NULL,
      PRIMARY KEY (user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

/**
 * Tables and columns for cardio sessions (runs, rides, rows, bouldering).
 * Safe to run on every start: each step is skipped when already applied.
 *
 * A cardio session is a row in `workouts` with kind = 'cardio' plus one row in
 * `cardio_sessions`, so history, streaks and the activity heatmap see every
 * session. `session_metrics` holds heart rate and calories for any session,
 * strength included (filled in from the watch once Strava sync exists).
 */
function ensureCardioSchema() {
  // 'strength' (sets) or 'cardio' (a cardio_sessions row). start_time is the
  // ISO timestamp the session started, when known (to match the same session
  // arriving from different sources).
  for (const column of ["kind TEXT NOT NULL DEFAULT 'strength'", 'start_time TEXT']) {
    try {
      db.run(`ALTER TABLE workouts ADD COLUMN ${column}`);
    } catch (e) {
      // Column already exists
    }
  }
  db.run('CREATE INDEX IF NOT EXISTS idx_workouts_user_kind_date ON workouts(user_id, kind, date)');

  // duration_s is moving time; distance and elevation in metres
  db.run(`
    CREATE TABLE IF NOT EXISTS cardio_sessions (
      workout_id INTEGER PRIMARY KEY,
      sport TEXT NOT NULL CHECK(sport IN ('run', 'ride', 'row', 'boulder', 'other')),
      environment TEXT CHECK(environment IN ('indoor', 'outdoor')),
      duration_s INTEGER NOT NULL,
      distance_m REAL,
      elevation_gain_m REAL,
      avg_cadence REAL,
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
    )
  `);

  // Route outline (Google encoded polyline) and per-km / per-mile splits
  // (JSON), filled in for sessions imported from Strava
  for (const column of ['summary_polyline TEXT', 'splits_json TEXT']) {
    try {
      db.run(`ALTER TABLE cardio_sessions ADD COLUMN ${column}`);
    } catch (e) {
      // Column already exists
    }
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS session_metrics (
      workout_id INTEGER PRIMARY KEY,
      avg_hr INTEGER,
      max_hr INTEGER,
      calories INTEGER,
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
    )
  `);
}

/**
 * Tables for syncing activities from Strava. Safe to run on every start.
 */
function ensureStravaSchema() {
  // One Strava connection per user. Tokens are stored encrypted.
  // backfill_before: epoch seconds the history import has reached (it walks
  // backwards); backfill_done: 1 once it reached the first activity.
  db.run(`
    CREATE TABLE IF NOT EXISTS strava_connections (
      user_id INTEGER PRIMARY KEY,
      athlete_id TEXT NOT NULL,
      athlete_name TEXT,
      access_token_encrypted TEXT NOT NULL,
      refresh_token_encrypted TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      scope TEXT,
      last_synced_at TEXT,
      last_activity_epoch INTEGER,
      backfill_before INTEGER,
      backfill_done INTEGER NOT NULL DEFAULT 0,
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_strava_connections_athlete ON strava_connections(athlete_id)');

  // Every Strava activity seen, and what became of it:
  //   cardio              imported as (or linked to) the cardio session workout_id
  //   strength_linked     its heart rate was added to the strength workout workout_id
  //   strength_unmatched  a lifting session with no workout here yet (linked when one appears)
  //   ignored             a type this app doesn't track
  //   dismissed           imported, then deleted here: not imported again
  // The metrics are kept so an unmatched lifting session can be linked later.
  db.run(`
    CREATE TABLE IF NOT EXISTS strava_activities (
      user_id INTEGER NOT NULL,
      activity_id TEXT NOT NULL,
      sport_type TEXT,
      name TEXT,
      start_date TEXT,
      start_date_local TEXT,
      elapsed_s INTEGER,
      avg_hr INTEGER,
      max_hr INTEGER,
      calories INTEGER,
      outcome TEXT NOT NULL,
      workout_id INTEGER,
      detailed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, activity_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_strava_activities_workout ON strava_activities(workout_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_strava_activities_outcome ON strava_activities(user_id, outcome)');
}

/**
 * Tables for analysis of second-by-second data (heart rate zones, best
 * efforts) and the athlete's heart rate settings. Safe to run on every start.
 */
function ensureAnalysisSchema() {
  // One row per session whose detailed data was looked for:
  //   status 'ok'    data stored (services/streamStore.js) and analysed
  //   status 'none'  the source has no detailed data for it
  // hr_histogram: JSON [[bpm, seconds], ...], so time in zones can be worked
  // out for any zone settings without reading the data again
  db.run(`
    CREATE TABLE IF NOT EXISTS session_analysis (
      workout_id INTEGER PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('ok', 'none')),
      hr_histogram TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
    )
  `);

  // Fastest time over standard distances within a run (effort_key: '400m', '1k', '1mi', '5k', ...)
  db.run(`
    CREATE TABLE IF NOT EXISTS best_efforts (
      workout_id INTEGER NOT NULL,
      effort_key TEXT NOT NULL,
      seconds REAL NOT NULL,
      PRIMARY KEY (workout_id, effort_key),
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_best_efforts_key ON best_efforts(effort_key)');

  // Heart rate settings, dated: a session uses the latest one in effect on its date
  db.run(`
    CREATE TABLE IF NOT EXISTS athlete_thresholds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      effective_date DATE NOT NULL,
      max_hr INTEGER NOT NULL,
      resting_hr INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, effective_date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

/**
 * Program additions: a paused lift (e.g. an injury) is skipped automatically
 * every week until it's resumed.
 */
function ensureProgramSchema() {
  try {
    db.run('ALTER TABLE program_lifts ADD COLUMN paused INTEGER NOT NULL DEFAULT 0');
  } catch (e) {
    // Column already exists
  }
}

/**
 * Sign-in tokens carry users.token_version; bumping it (on a password
 * change) ends every session signed in before.
 */
function ensureAuthSchema() {
  try {
    db.run('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0');
  } catch (e) {
    // Column already exists
  }
}

/**
 * Custom exercises belong to the user who made them (exercises.user_id);
 * the built-in library has user_id NULL and everyone sees it.
 *
 * Until now every exercise was shared, and the only way to make one was a
 * Hevy import. When the column is first added, each such exercise (not in
 * the built-in list, and mapped from Hevy) goes to the one user who uses it.
 * One used by several users, or by none, stays shared.
 */
function ensureExerciseOwnerSchema() {
  try {
    db.run('ALTER TABLE exercises ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
  } catch (e) {
    db.run('CREATE INDEX IF NOT EXISTS idx_exercises_user ON exercises(user_id)');
    return; // Column already exists: assigned already
  }
  db.run('CREATE INDEX IF NOT EXISTS idx_exercises_user ON exercises(user_id)');

  const builtIn = new Set(SEED_EXERCISES.map((e) => e.name.trim().toLowerCase()));
  const hevyTable = db.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'hevy_exercise_mappings'").length > 0;
  if (!hevyTable) return;

  const candidates = db.exec('SELECT DISTINCT e.id, e.name FROM exercises e JOIN hevy_exercise_mappings m ON m.exercise_id = e.id')[0]?.values ?? [];
  let assigned = 0;
  let shared = 0;
  for (const [id, name] of candidates) {
    if (builtIn.has(String(name).trim().toLowerCase())) continue;
    const users = db.exec(
      `SELECT user_id FROM hevy_exercise_mappings WHERE exercise_id = ?
       UNION SELECT w.user_id FROM sets s JOIN workouts w ON w.id = s.workout_id WHERE s.exercise_id = ?
       UNION SELECT t.user_id FROM template_sets ts JOIN workout_templates t ON t.id = ts.template_id WHERE ts.exercise_id = ?
       UNION SELECT p.user_id FROM program_lifts pl JOIN programs p ON p.id = pl.program_id WHERE pl.exercise_id = ?`,
      [id, id, id, id]
    )[0]?.values ?? [];
    if (users.length === 1) {
      db.run('UPDATE exercises SET user_id = ? WHERE id = ?', [users[0][0], id]);
      assigned++;
    } else {
      shared++;
    }
  }
  if (assigned || shared) {
    logger.info(`🏷️ Custom exercises: ${assigned} assigned to their user, ${shared} used by several users left shared`);
  }
}

/**
 * "Back" was one muscle group; it is now "Upper Back" and "Lower Back".
 * Built-in exercises take their muscle groups from SEED_EXERCISES; any
 * other exercise still tagged "Back" (custom or imported) becomes Upper Back,
 * where most back accessory work lands. Does nothing once no "Back" is left.
 */
function splitBackMuscleGroup() {
  const rows = db.exec(
    `SELECT id, name, user_id, primary_muscle_group, secondary_muscle_groups FROM exercises
     WHERE primary_muscle_group = 'Back' OR secondary_muscle_groups LIKE '%"Back"%'`
  )[0]?.values ?? [];
  if (rows.length === 0) return;

  const seeds = new Map(SEED_EXERCISES.map((e) => [e.name.trim().toLowerCase(), e]));
  for (const [id, name, userId, primary, secondary] of rows) {
    const seed = userId == null ? seeds.get(String(name).trim().toLowerCase()) : null;
    if (seed) {
      db.run('UPDATE exercises SET primary_muscle_group = ?, secondary_muscle_groups = ? WHERE id = ?', [seed.primary, seed.secondary, id]);
      continue;
    }
    let groups = [];
    try {
      groups = JSON.parse(secondary || '[]');
    } catch {
      groups = [];
    }
    const nextPrimary = primary === 'Back' ? 'Upper Back' : primary;
    const nextSecondary = [...new Set((Array.isArray(groups) ? groups : []).map((g) => (g === 'Back' ? 'Upper Back' : g)))]
      .filter((g) => g !== nextPrimary);
    db.run('UPDATE exercises SET primary_muscle_group = ?, secondary_muscle_groups = ? WHERE id = ?', [nextPrimary, JSON.stringify(nextSecondary), id]);
  }
  logger.info(`💪 Split "Back" into Upper Back / Lower Back on ${rows.length} exercises`);
}

/**
 * Turn on foreign key enforcement, so ON DELETE CASCADE works (SQLite leaves
 * it off by default). It was off until now, so first remove rows whose
 * cascading parent is already gone (e.g. sets of deleted workouts); turning
 * it on doesn't check existing rows. Runs after the schema changes above.
 */
function enableForeignKeys() {
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")[0]?.values.map(([name]) => name) ?? [];
  const cascades = [];
  for (const table of tables) {
    const keys = db.exec(`PRAGMA foreign_key_list("${table}")`)[0];
    if (!keys) continue;
    const col = Object.fromEntries(keys.columns.map((c, i) => [c, i]));
    for (const row of keys.values) {
      if (String(row[col.on_delete]).toUpperCase() === 'CASCADE') {
        cascades.push({ table, from: row[col.from], parent: row[col.table], to: row[col.to] || 'id' });
      }
    }
  }

  // Repeat until nothing changes: removing a row can orphan its own children
  let removed = 0;
  for (let pass = 0; pass < 10; pass++) {
    let changed = 0;
    for (const { table, from, parent, to } of cascades) {
      db.run(
        `DELETE FROM "${table}" WHERE "${from}" IS NOT NULL AND "${from}" NOT IN (SELECT "${to}" FROM "${parent}")`
      );
      changed += db.getRowsModified();
    }
    removed += changed;
    if (changed === 0) break;
  }
  if (removed > 0) logger.info(`🧹 Removed ${removed} orphaned rows before enabling foreign keys`);

  db.run('PRAGMA foreign_keys = ON');

  const violations = db.exec('PRAGMA foreign_key_check')[0]?.values.length ?? 0;
  if (violations > 0) {
    logger.warn(`⚠️ ${violations} rows reference missing rows (not removed; see PRAGMA foreign_key_check)`);
  }
}

/** The built-in exercise library (user_id NULL), seeded into new databases. */
const SEED_EXERCISES = [
    // Main Compound Lifts
    { name: 'Barbell Squat', category: 'barbell', primary: 'Quadriceps', secondary: '["Glutes","Hamstrings","Core"]', compound: 1 },
    { name: 'Barbell Bench Press', category: 'barbell', primary: 'Chest', secondary: '["Triceps","Shoulders"]', compound: 1 },
    { name: 'Barbell Deadlift', category: 'barbell', primary: 'Lower Back', secondary: '["Hamstrings","Glutes","Upper Back","Core"]', compound: 1 },
    { name: 'Barbell Overhead Press', category: 'barbell', primary: 'Shoulders', secondary: '["Triceps","Core"]', compound: 1 },
    { name: 'Barbell Row', category: 'barbell', primary: 'Upper Back', secondary: '["Biceps","Core"]', compound: 1 },
    
    // Squat Variations
    { name: 'Front Squat', category: 'barbell', primary: 'Quadriceps', secondary: '["Core","Glutes"]', compound: 1 },
    { name: 'Bulgarian Split Squat', category: 'dumbbell', primary: 'Quadriceps', secondary: '["Glutes","Core"]', compound: 1 },
    { name: 'Goblet Squat', category: 'dumbbell', primary: 'Quadriceps', secondary: '["Glutes","Core"]', compound: 1 },
    
    // Bench Variations
    { name: 'Incline Barbell Bench Press', category: 'barbell', primary: 'Chest', secondary: '["Shoulders","Triceps"]', compound: 1 },
    { name: 'Dumbbell Bench Press', category: 'dumbbell', primary: 'Chest', secondary: '["Triceps","Shoulders"]', compound: 1 },
    { name: 'Incline Dumbbell Press', category: 'dumbbell', primary: 'Chest', secondary: '["Shoulders","Triceps"]', compound: 1 },
    
    // Deadlift Variations
    { name: 'Romanian Deadlift', category: 'barbell', primary: 'Hamstrings', secondary: '["Lower Back","Glutes"]', compound: 1 },
    { name: 'Sumo Deadlift', category: 'barbell', primary: 'Lower Back', secondary: '["Glutes","Hamstrings","Upper Back"]', compound: 1 },
    { name: 'Trap Bar Deadlift', category: 'barbell', primary: 'Lower Back', secondary: '["Quadriceps","Glutes"]', compound: 1 },
    
    // Pull Exercises
    { name: 'Pull-up', category: 'bodyweight', primary: 'Upper Back', secondary: '["Biceps"]', compound: 1 },
    {name: 'Machine-Assisted Pull-up', category: 'machine', primary: 'Upper Back', secondary: '["Biceps"]', compound: 1 },
    { name: 'Chin-up', category: 'bodyweight', primary: 'Upper Back', secondary: '["Biceps"]', compound: 1 },
    { name: 'Lat Pulldown', category: 'cable', primary: 'Upper Back', secondary: '["Biceps"]', compound: 0 },
    { name: 'Cable Row', category: 'cable', primary: 'Upper Back', secondary: '["Biceps"]', compound: 0 },
    { name: 'Dumbbell Row', category: 'dumbbell', primary: 'Upper Back', secondary: '["Biceps"]', compound: 0 },
    
    // Shoulder Exercises
    { name: 'Dumbbell Overhead Press', category: 'dumbbell', primary: 'Shoulders', secondary: '["Triceps"]', compound: 1 },
    { name: 'Lateral Raise', category: 'dumbbell', primary: 'Shoulders', secondary: '[]', compound: 0 },
    { name: 'Face Pull', category: 'cable', primary: 'Shoulders', secondary: '["Upper Back"]', compound: 0 },
    
    // Leg Exercises
    { name: 'Leg Press', category: 'machine', primary: 'Quadriceps', secondary: '["Glutes"]', compound: 1 },
    { name: 'Leg Curl', category: 'machine', primary: 'Hamstrings', secondary: '[]', compound: 0 },
    { name: 'Leg Extension', category: 'machine', primary: 'Quadriceps', secondary: '[]', compound: 0 },
    { name: 'Lunges', category: 'bodyweight', primary: 'Quadriceps', secondary: '["Glutes"]', compound: 1 },
    { name: 'Barbell Calf Raise', category: 'barbell', primary: 'Calves', secondary: '[]', compound: 0 },
    
    // Arm Exercises
    { name: 'Barbell Curl', category: 'barbell', primary: 'Biceps', secondary: '[]', compound: 0 },
    { name: 'Dumbbell Curl', category: 'dumbbell', primary: 'Biceps', secondary: '[]', compound: 0 },
    { name: 'Hammer Curl', category: 'dumbbell', primary: 'Biceps', secondary: '["Forearms"]', compound: 0 },
    { name: 'Tricep Pushdown', category: 'cable', primary: 'Triceps', secondary: '[]', compound: 0 },
    { name: 'Dumbbell Tricep Extension', category: 'dumbbell', primary: 'Triceps', secondary: '[]', compound: 0 },
    
    // Core
    { name: 'Plank', category: 'bodyweight', primary: 'Core', secondary: '[]', compound: 0 },
    { name: 'Ab Wheel Rollout', category: 'other', primary: 'Core', secondary: '[]', compound: 0 },
    { name: 'Hanging Leg Raise', category: 'bodyweight', primary: 'Core', secondary: '[]', compound: 0 }
];

/**
 * Seed the database with common exercises
 */
function seedExercises() {
  console.log('🌱 Seeding exercises...');
  
  
  const stmt = db.prepare(`
    INSERT INTO exercises (name, category, primary_muscle_group, secondary_muscle_groups, is_compound)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  SEED_EXERCISES.forEach(ex => {
    stmt.run([ex.name, ex.category, ex.primary, ex.secondary, ex.compound]);
  });
  
  stmt.free();
  console.log(`✅ Seeded ${SEED_EXERCISES.length} exercises`);
}

/**
 * Save database to disk
 */
export function saveDatabase() {
  if (!db) {
    console.error('Database not initialized');
    return;
  }
  
  try {
    const dbPath = databasePath();
    const data = db.export();
    fs.writeFileSync(dbPath, data);
  } catch (error) {
    console.error('Error saving database:', error);
    throw error;
  }
}

/**
 * Get database instance
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Execute a query
 */
export function query(sql, params = []) {
  const db = getDatabase();
  return db.exec(sql, params);
}

// Nesting depth of transaction() calls. While > 0, run() skips the per-statement
// disk write and the outermost transaction() writes the database once on commit.
// This matters in production, where the DB file sits on a Cloud Storage (GCSFuse)
// mount and every saveDatabase() uploads the whole file.
let transactionDepth = 0;

/**
 * Run a query that modifies data
 */
export function run(sql, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  if (transactionDepth === 0) {
    saveDatabase();
  }
}

/**
 * Run a query that inserts a row and return the new row's id
 */
export function insert(sql, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  // Read the id before saving: sql.js export() closes and reopens the
  // database, which resets last_insert_rowid().
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  if (transactionDepth === 0) {
    saveDatabase();
  }
  return id;
}

/**
 * Run fn inside a single SQL transaction and persist to disk once at the end.
 * Rolls back (and skips the disk write) if fn throws. Nested calls join the
 * outer transaction. fn must be synchronous.
 */
export function transaction(fn) {
  const db = getDatabase();
  if (transactionDepth > 0) {
    return fn();
  }

  db.run('BEGIN TRANSACTION');
  transactionDepth = 1;
  try {
    const result = fn();
    db.run('COMMIT');
    transactionDepth = 0;
    saveDatabase();
    return result;
  } catch (error) {
    transactionDepth = 0;
    try {
      db.run('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    throw error;
  }
}

/**
 * Get a single row
 */
export function get(sql, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return result;
}

/**
 * Get all rows
 */
export function all(sql, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export default {
  initDatabase,
  saveDatabase,
  getDatabase,
  query,
  run,
  insert,
  transaction,
  get,
  all
};