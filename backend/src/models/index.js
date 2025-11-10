/**
 * Models Index
 * Central export for all database models
 */

import User from './User.js';
import Exercise from './Exercise.js';
import Workout from './Workout.js';
import Set from './Set.js';
import Program from './Program.js';
import BodyweightLog from './BodyweightLog.js';
import { WorkoutTemplate, TemplateSet } from './WorkoutTemplate.js';
import PlateInventoryPreset from './PlateInventoryPreset.js';

export {
  User,
  Exercise,
  Workout,
  Set,
  Program,
  BodyweightLog,
  WorkoutTemplate,
  TemplateSet,
  PlateInventoryPreset
};

export default {
  User,
  Exercise,
  Workout,
  Set,
  Program,
  BodyweightLog,
  WorkoutTemplate,
  TemplateSet,
  PlateInventoryPreset
};