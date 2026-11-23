import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { databasePath } from '../config/database.js';

/**
 * Second-by-second session data, kept as one gzipped JSON file per workout
 * next to the database (in production, the same Cloud Storage mount) rather
 * than in it: sql.js holds the whole database in memory and rewrites it on
 * every save, and a few hundred activities of streams would bloat it.
 *
 * STREAMS_DIR overrides the folder (default: <database folder>/streams).
 */

function folder() {
  return process.env.STREAMS_DIR || path.join(path.dirname(databasePath()), 'streams');
}

const fileFor = (workoutId) => path.join(folder(), `${Number(workoutId)}.json.gz`);

export function saveStream(workoutId, stream) {
  fs.mkdirSync(folder(), { recursive: true });
  fs.writeFileSync(fileFor(workoutId), zlib.gzipSync(JSON.stringify(stream)));
}

/** The stored stream, or null when there's none (or it can't be read). */
export function readStream(workoutId) {
  try {
    return JSON.parse(zlib.gunzipSync(fs.readFileSync(fileFor(workoutId))).toString('utf8'));
  } catch {
    return null;
  }
}

export function removeStream(workoutId) {
  try {
    fs.unlinkSync(fileFor(workoutId));
  } catch {
    // Already gone
  }
}
