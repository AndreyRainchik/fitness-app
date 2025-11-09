#!/usr/bin/env node
// ============================================================================
// DATABASE BACKUP UTILITY
// ============================================================================
// Simple script to backup SQLite database
// Usage: node backup-database.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DB_PATH = process.env.DATABASE_PATH || './fitness.db';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const KEEP_BACKUPS = parseInt(process.env.KEEP_BACKUPS || '7', 10);

/**
 * Create backup directory if it doesn't exist
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`✅ Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Generate backup filename with timestamp
 */
function getBackupFilename() {
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `fitness-backup-${timestamp}.db`;
}

/**
 * Create database backup
 */
function backupDatabase() {
  try {
    // Check if source database exists
    if (!fs.existsSync(DB_PATH)) {
      console.error(`❌ Database not found: ${DB_PATH}`);
      process.exit(1);
    }

    // Get database stats
    const stats = fs.statSync(DB_PATH);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`📊 Database size: ${sizeMB} MB`);
    console.log(`📁 Source: ${DB_PATH}`);

    // Ensure backup directory exists
    ensureBackupDir();

    // Create backup
    const backupFilename = getBackupFilename();
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    console.log(`💾 Creating backup: ${backupFilename}`);
    fs.copyFileSync(DB_PATH, backupPath);

    // Verify backup
    const backupStats = fs.statSync(backupPath);
    if (backupStats.size === stats.size) {
      console.log(`✅ Backup created successfully: ${backupPath}`);
      console.log(`✅ Backup size: ${(backupStats.size / (1024 * 1024)).toFixed(2)} MB`);
    } else {
      console.error(`❌ Backup verification failed - size mismatch`);
      process.exit(1);
    }

    // Clean up old backups
    cleanupOldBackups();

  } catch (error) {
    console.error(`❌ Backup failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Remove old backups, keeping only the most recent ones
 */
function cleanupOldBackups() {
  try {
    // Get all backup files
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('fitness-backup-') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time); // Sort by newest first

    // If we have more backups than we want to keep
    if (files.length > KEEP_BACKUPS) {
      console.log(`\n🧹 Cleaning up old backups (keeping ${KEEP_BACKUPS} most recent)...`);
      
      const filesToDelete = files.slice(KEEP_BACKUPS);
      
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`   Deleted: ${file.name}`);
      });

      console.log(`✅ Cleaned up ${filesToDelete.length} old backup(s)`);
    }

    // List remaining backups
    const remaining = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('fitness-backup-') && file.endsWith('.db'))
      .length;

    console.log(`\n📦 Total backups: ${remaining}`);

  } catch (error) {
    console.error(`⚠️  Cleanup warning: ${error.message}`);
  }
}

/**
 * List all existing backups
 */
function listBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      console.log('📦 No backups found (backup directory does not exist)');
      return;
    }

    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('fitness-backup-') && file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
          date: stats.mtime.toLocaleString(),
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (backups.length === 0) {
      console.log('📦 No backups found');
      return;
    }

    console.log(`\n📦 Found ${backups.length} backup(s):\n`);
    backups.forEach((backup, index) => {
      console.log(`${index + 1}. ${backup.name}`);
      console.log(`   Size: ${backup.size}`);
      console.log(`   Date: ${backup.date}\n`);
    });

  } catch (error) {
    console.error(`❌ Failed to list backups: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Restore from a backup
 */
function restoreDatabase(backupFilename) {
  try {
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    // Check if backup exists
    if (!fs.existsSync(backupPath)) {
      console.error(`❌ Backup not found: ${backupPath}`);
      process.exit(1);
    }

    // Create backup of current database before restoring
    if (fs.existsSync(DB_PATH)) {
      const currentBackupName = `pre-restore-${getBackupFilename()}`;
      const currentBackupPath = path.join(BACKUP_DIR, currentBackupName);
      fs.copyFileSync(DB_PATH, currentBackupPath);
      console.log(`✅ Created backup of current database: ${currentBackupName}`);
    }

    // Restore from backup
    console.log(`🔄 Restoring from: ${backupFilename}`);
    fs.copyFileSync(backupPath, DB_PATH);
    
    console.log(`✅ Database restored successfully`);

  } catch (error) {
    console.error(`❌ Restore failed: ${error.message}`);
    process.exit(1);
  }
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

const command = process.argv[2];

console.log('🗄️  Database Backup Utility\n');

switch (command) {
  case 'backup':
  case undefined:
    backupDatabase();
    break;

  case 'list':
    listBackups();
    break;

  case 'restore':
    const backupFile = process.argv[3];
    if (!backupFile) {
      console.error('❌ Please specify a backup file to restore');
      console.log('Usage: node backup-database.js restore <backup-filename>');
      process.exit(1);
    }
    restoreDatabase(backupFile);
    break;

  case 'help':
    console.log('Usage:');
    console.log('  node backup-database.js [command]');
    console.log('');
    console.log('Commands:');
    console.log('  backup          Create a new backup (default)');
    console.log('  list            List all available backups');
    console.log('  restore <file>  Restore from a specific backup');
    console.log('  help            Show this help message');
    console.log('');
    console.log('Environment Variables:');
    console.log('  DATABASE_PATH   Path to database file (default: ./fitness.db)');
    console.log('  BACKUP_DIR      Path to backup directory (default: ./backups)');
    console.log('  KEEP_BACKUPS    Number of backups to keep (default: 7)');
    break;

  default:
    console.error(`❌ Unknown command: ${command}`);
    console.log('Run "node backup-database.js help" for usage information');
    process.exit(1);
}