// Shared Analytics constants and helpers.

/** Badge tone for each strength standard level. */
export const LEVEL_TONES = {
  Elite: 'purple',
  Advanced: 'danger',
  Intermediate: 'warning',
  Novice: 'primary',
  Beginner: 'success',
  Untrained: 'neutral',
};

/** How far an estimated 1RM is toward the next level's weight, 0–100 (100 at the top level). */
export function levelProgress(lift) {
  if (!lift?.nextLevel) return 100;
  return Math.min(Math.round((lift.estimated1RM / lift.nextLevel.weight) * 100), 100);
}

/** Label, badge tone and explanation for each training form status (see services/trainingLoad.js). */
export const FORM_STATUS = {
  fresh: { label: 'Fresh', tone: 'success', text: 'Rested. A good time to race or test yourself.' },
  neutral: { label: 'Neutral', tone: 'neutral', text: 'Training and recovery are balanced; fitness is holding.' },
  productive: { label: 'Productive', tone: 'primary', text: 'Building fitness, with fatigue in a healthy range.' },
  overreaching: { label: 'Overreaching', tone: 'danger', text: 'Fatigue is high. Plan a few easier days.' },
};
