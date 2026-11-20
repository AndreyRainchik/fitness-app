/**
 * Minimal client for Hevy's public API (https://api.hevyapp.com/docs).
 * Requires a Hevy Pro API key, sent in the `api-key` header.
 *
 * HEVY_API_BASE_URL overrides the base URL (used by the tests' mock server).
 */

const DEFAULT_BASE_URL = 'https://api.hevyapp.com';
const REQUEST_TIMEOUT_MS = 15000;

/** Largest page size Hevy accepts for /v1/workouts and /v1/workouts/events. */
export const HEVY_WORKOUTS_PAGE_SIZE = 10;

export class HevyApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'HevyApiError';
    this.status = status;
  }

  /** True when Hevy rejected the API key itself. */
  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }
}

function baseUrl() {
  return (process.env.HEVY_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

export class HevyClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async request(path, query = {}) {
    const url = new URL(`${baseUrl()}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    let response;
    try {
      response = await fetch(url, {
        headers: { 'api-key': this.apiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error.name === 'TimeoutError' ? 'timed out' : 'could not be reached';
      throw new HevyApiError(`Hevy ${reason}. Try again in a moment.`, 502);
    }

    if (response.status === 401 || response.status === 403) {
      throw new HevyApiError('Hevy rejected the API key. Check it in Hevy (Settings > Developer) and reconnect.', response.status);
    }
    if (response.status === 404) {
      throw new HevyApiError('Not found in Hevy', 404);
    }
    if (response.status === 429) {
      throw new HevyApiError('Hevy is rate limiting requests. Wait a minute and try again.', 429);
    }
    if (!response.ok) {
      throw new HevyApiError(`Hevy returned an error (HTTP ${response.status})`, 502);
    }

    try {
      return await response.json();
    } catch {
      throw new HevyApiError('Hevy sent a response that could not be read', 502);
    }
  }

  /** { id, username, name, weight_unit, is_pro, ... } */
  async getUserInfo() {
    const body = await this.request('/v1/user/info');
    return body.data ?? body;
  }

  /** Newest first. Returns { page, page_count, workouts }. */
  async listWorkouts(page = 1, pageSize = HEVY_WORKOUTS_PAGE_SIZE) {
    const body = await this.request('/v1/workouts', { page, pageSize });
    return { page: body.page ?? page, page_count: body.page_count ?? 1, workouts: body.workouts ?? [] };
  }

  /**
   * Workouts created, edited or deleted after `since` (ISO timestamp).
   * Returns { page, page_count, events: [{ type: 'updated', workout } | { type: 'deleted', id }] }.
   */
  async listWorkoutEvents(since, page = 1, pageSize = HEVY_WORKOUTS_PAGE_SIZE) {
    const body = await this.request('/v1/workouts/events', { since, page, pageSize });
    return { page: body.page ?? page, page_count: body.page_count ?? 1, events: body.events ?? [] };
  }

  async getWorkout(workoutId) {
    const body = await this.request(`/v1/workouts/${encodeURIComponent(workoutId)}`);
    // The API has returned both a bare workout and { workout }
    return body.workout ?? body;
  }

  /** { id, title, type, primary_muscle_group, secondary_muscle_groups, equipment, is_custom } */
  async getExerciseTemplate(templateId) {
    const body = await this.request(`/v1/exercise_templates/${encodeURIComponent(templateId)}`);
    return body.exercise_template ?? body;
  }
}
