import { initDatabase, all } from './config/database.js';

async function showExercisesByMuscle() {
  console.log('📋 Exercise Library by Muscle Group\n');
  
  try {
    await initDatabase();
    
    // Get all unique muscle groups
    const muscleGroups = all(`
      SELECT DISTINCT primary_muscle_group 
      FROM exercises 
      ORDER BY primary_muscle_group
    `);
    
    // Show exercises for each muscle group
    muscleGroups.forEach(group => {
      const exercises = all(`
        SELECT name, category, is_compound 
        FROM exercises 
        WHERE primary_muscle_group = ?
        ORDER BY is_compound DESC, name
      `, [group.primary_muscle_group]);
      
      console.log(`\n${group.primary_muscle_group.toUpperCase()} (${exercises.length} exercises):`);
      exercises.forEach(ex => {
        const type = ex.is_compound ? '🔶 Compound' : '◾ Isolation';
        console.log(`  ${type} - ${ex.name} (${ex.category})`);
      });
    });
    
    const total = all('SELECT COUNT(*) as count FROM exercises');
    console.log(`\n\n📊 Total: ${total[0].count} exercises`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

showExercisesByMuscle();