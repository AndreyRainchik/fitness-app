/**
 * Migration Script: Add Starting Strength Support to Programs Table
 * 
 * This script updates the CHECK constraint on the programs table
 * to include 'starting_strength' as a valid program type.
 * 
 * Run this ONCE on your existing database by executing:
 * node backend/src/migrations/add-starting-strength.js
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  try {
    console.log('🔄 Starting migration: Add Starting Strength support...\n');

    // Initialize sql.js
    const SQL = await initSqlJs();
    
    // Load existing database
    const dbPath = path.join(__dirname, '../', process.env.DB_PATH || 'fitness.db');
    
    if (!fs.existsSync(dbPath)) {
      console.error('❌ Database file not found at:', dbPath);
      console.log('If this is a new database, the schema will be created with Starting Strength support automatically.');
      process.exit(1);
    }

    console.log('📂 Loading database from:', dbPath);
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // Create backup
    const backupPath = dbPath.replace('.db', `.backup-${Date.now()}.db`);
    fs.copyFileSync(dbPath, backupPath);
    console.log('✅ Backup created at:', backupPath);

    // Begin transaction
    db.run('BEGIN TRANSACTION');

    try {
      // Step 1: Create new programs table with updated constraint
      console.log('\n📋 Creating new programs table with Starting Strength support...');
      db.run(`
        CREATE TABLE programs_new (
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

      // Step 2: Copy all existing data
      console.log('📦 Copying existing programs data...');
      db.run(`
        INSERT INTO programs_new (id, user_id, name, type, start_date, current_week, current_cycle, is_active, created_at)
        SELECT id, user_id, name, type, start_date, current_week, current_cycle, is_active, created_at
        FROM programs
      `);

      // Step 3: Drop old table
      console.log('🗑️  Dropping old programs table...');
      db.run('DROP TABLE programs');

      // Step 4: Rename new table
      console.log('✏️  Renaming new table to programs...');
      db.run('ALTER TABLE programs_new RENAME TO programs');

      // Commit transaction
      db.run('COMMIT');
      console.log('\n✅ Migration completed successfully!');

      // Verify the change
      const stmt = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='programs'");
      if (stmt.step()) {
        const tableSchema = stmt.getAsObject();
        console.log('\n📊 Updated table schema:');
        console.log(tableSchema.sql);
        
        if (tableSchema.sql.includes('starting_strength')) {
          console.log('\n✅ Verified: starting_strength is now a valid program type!');
        }
      }
      stmt.free();

      // Save the updated database
      const data = db.export();
      fs.writeFileSync(dbPath, data);
      console.log('\n💾 Database saved successfully');

      db.close();
      console.log('\n🎉 Migration complete! You can now create Starting Strength programs.');

    } catch (error) {
      // Rollback on error
      console.error('\n❌ Migration failed:', error.message);
      db.run('ROLLBACK');
      console.log('🔙 Changes rolled back');
      
      // Restore from backup
      if (fs.existsSync(backupPath)) {
        console.log('📂 Restoring from backup...');
        fs.copyFileSync(backupPath, dbPath);
        console.log('✅ Database restored from backup');
      }
      
      throw error;
    }

  } catch (error) {
    console.error('\n❌ Migration error:', error);
    process.exit(1);
  }
}

// Run migration
migrate();