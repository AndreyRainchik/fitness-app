import { initDatabase, all } from './config/database.js';

async function testDatabase() {
  console.log('🧪 Testing Database...\n');
  
  try {
    await initDatabase();
    
    // Test 1: Count exercises
    const exercises = all('SELECT COUNT(*) as count FROM exercises');
    console.log(`✅ Total exercises: ${exercises[0].count}`);
    
    // Test 2: Show some exercises
    const sampleExercises = all(`
      SELECT name, category, primary_muscle_group, is_compound 
      FROM exercises 
      LIMIT 5
    `);
    console.log('\n📋 Sample exercises:');
    sampleExercises.forEach(ex => {
      console.log(`  - ${ex.name} (${ex.category}) - Primary: ${ex.primary_muscle_group}`);
    });
    
    // Test 3: Check tables
    const tables = all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
    console.log('\n📊 Database tables:');
    tables.forEach(t => {
      console.log(`  - ${t.name}`);
    });
    
    console.log('\n✅ Database test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  }
}

testDatabase();