import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;
let SQL = null;

/**
 * Initialize the SQLite database
 */
export async function initDatabase() {
  try {
    // Initialize sql.js
    SQL = await initSqlJs();
    
    const dbPath = path.join(__dirname, '../../', process.env.DB_PATH || 'fitness.db');
    
    // Check if database file exists
    if (fs.existsSync(dbPath)) {
      console.log('📂 Loading existing database...');
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      console.log('🆕 Creating new database...');
      db = new SQL.Database();
      createTables();
      seedExercises();
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      type TEXT CHECK(type IN ('531', 'custom')),
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
  
  // Create indexes for better query performance
  db.run('CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sets_workout ON sets(workout_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets(exercise_id)');
  
  console.log('✅ Tables created successfully');
}

/**
 * Seed the database with common exercises
 */
function seedExercises() {
  console.log('🌱 Seeding exercises...');
  
  const exercises = [
    // Main Compound Lifts
    { name: 'Barbell Squat', category: 'barbell', primary: 'Quadriceps', secondary: '["Glutes","Hamstrings","Core"]', compound: 1 },
    { name: 'Barbell Bench Press', category: 'barbell', primary: 'Chest', secondary: '["Triceps","Shoulders"]', compound: 1 },
    { name: 'Barbell Deadlift', category: 'barbell', primary: 'Back', secondary: '["Hamstrings","Glutes","Core"]', compound: 1 },
    { name: 'Barbell Overhead Press', category: 'barbell', primary: 'Shoulders', secondary: '["Triceps","Core"]', compound: 1 },
    { name: 'Barbell Row', category: 'barbell', primary: 'Back', secondary: '["Biceps","Core"]', compound: 1 },
    
    // Squat Variations
    { name: 'Front Squat', category: 'barbell', primary: 'Quadriceps', secondary: '["Core","Glutes"]', compound: 1 },
    { name: 'Bulgarian Split Squat', category: 'dumbbell', primary: 'Quadriceps', secondary: '["Glutes","Core"]', compound: 1 },
    { name: 'Goblet Squat', category: 'dumbbell', primary: 'Quadriceps', secondary: '["Glutes","Core"]', compound: 1 },
    
    // Bench Variations
    { name: 'Incline Barbell Bench Press', category: 'barbell', primary: 'Chest', secondary: '["Shoulders","Triceps"]', compound: 1 },
    { name: 'Dumbbell Bench Press', category: 'dumbbell', primary: 'Chest', secondary: '["Triceps","Shoulders"]', compound: 1 },
    { name: 'Incline Dumbbell Press', category: 'dumbbell', primary: 'Chest', secondary: '["Shoulders","Triceps"]', compound: 1 },
    
    // Deadlift Variations
    { name: 'Romanian Deadlift', category: 'barbell', primary: 'Hamstrings', secondary: '["Back","Glutes"]', compound: 1 },
    { name: 'Sumo Deadlift', category: 'barbell', primary: 'Back', secondary: '["Glutes","Hamstrings"]', compound: 1 },
    { name: 'Trap Bar Deadlift', category: 'barbell', primary: 'Back', secondary: '["Quadriceps","Glutes"]', compound: 1 },
    
    // Pull Exercises
    { name: 'Pull-up', category: 'bodyweight', primary: 'Back', secondary: '["Biceps"]', compound: 1 },
    {name: 'Machine-Assisted Pull-up', category: 'machine', primary: 'Back', secondary: '["Biceps"]', compound: 1 },
    { name: 'Chin-up', category: 'bodyweight', primary: 'Back', secondary: '["Biceps"]', compound: 1 },
    { name: 'Lat Pulldown', category: 'cable', primary: 'Back', secondary: '["Biceps"]', compound: 0 },
    { name: 'Cable Row', category: 'cable', primary: 'Back', secondary: '["Biceps"]', compound: 0 },
    { name: 'Dumbbell Row', category: 'dumbbell', primary: 'Back', secondary: '["Biceps"]', compound: 0 },
    
    // Shoulder Exercises
    { name: 'Dumbbell Overhead Press', category: 'dumbbell', primary: 'Shoulders', secondary: '["Triceps"]', compound: 1 },
    { name: 'Lateral Raise', category: 'dumbbell', primary: 'Shoulders', secondary: '[]', compound: 0 },
    { name: 'Face Pull', category: 'cable', primary: 'Shoulders', secondary: '["Back"]', compound: 0 },
    
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
  
  const stmt = db.prepare(`
    INSERT INTO exercises (name, category, primary_muscle_group, secondary_muscle_groups, is_compound)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  exercises.forEach(ex => {
    stmt.run([ex.name, ex.category, ex.primary, ex.secondary, ex.compound]);
  });
  
  stmt.free();
  console.log(`✅ Seeded ${exercises.length} exercises`);
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
    const dbPath = path.join(__dirname, '../../', process.env.DB_PATH || 'fitness.db');
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

/**
 * Run a query that modifies data
 */
export function run(sql, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  saveDatabase();
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
  get,
  all
};