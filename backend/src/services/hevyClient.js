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

  /**
   * Call the API. Returns the parsed JSON body, or null for an empty body
   * (Hevy answers 201 Created with no body). Throws HevyApiError; 404 and 409
   * keep their status so callers can handle them.
   */
  async request(path, { method = 'GET', query = {}, body } = {}) {
    const url = new URL(`${baseUrl()}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    let response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          'api-key': this.apiKey,
          accept: 'application/json',
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error.name === 'TimeoutError' ? 'timed out' : 'could not be reached';
      throw new HevyApiError(`Hevy ${reason}. Try again in a moment.`, 502);
    }

    const text = await response.text().catch(() => '');
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (response.ok) throw new HevyApiError('Hevy sent a response that could not be read', 502);
      }
    }
    const hevyMessage = typeof data?.error === 'string' ? data.error : null;

    if (response.status === 401 || response.status === 403) {
      throw new HevyApiError('Hevy rejected the API key. Check it in Hevy (Settings > Developer) and reconnect.', response.status);
    }
    if (response.status === 404) {
      throw new HevyApiError(hevyMessage || 'Not found in Hevy', 404);
    }
    if (response.status === 409) {
      throw new HevyApiError(hevyMessage || 'Hevy already has an entry for this', 409);
    }
    if (response.status === 429) {
      throw new HevyApiError('Hevy is rate limiting requests. Wait a minute and try again.', 429);
    }
    if (response.status === 400) {
      throw new HevyApiError(hevyMessage ? `Hevy refused the request: ${hevyMessage}` : 'Hevy refused the request', 400);
    }
    if (!response.ok) {
      throw new HevyApiError(`Hevy returned an error (HTTP ${response.status})`, 502);
    }
    return data;
  }

  /** { id, username, name, weight_unit, is_pro, ... } */
  async getUserInfo() {
    const body = await this.request('/v1/user/info');
    return body.data ?? body;
  }

  /** Newest first. Returns { page, page_count, workouts }. */
  async listWorkouts(page = 1, pageSize = HEVY_WORKOUTS_PAGE_SIZE) {
    const body = await this.request('/v1/workouts', { query: { page, pageSize } });
    return { page: body.page ?? page, page_count: body.page_count ?? 1, workouts: body.workouts ?? [] };
  }

  /**
   * Workouts created, edited or deleted after `since` (ISO timestamp).
   * Returns { page, page_count, events: [{ type: 'updated', workout } | { type: 'deleted', id }] }.
   */
  async listWorkoutEvents(since, page = 1, pageSize = HEVY_WORKOUTS_PAGE_SIZE) {
    const body = await this.request('/v1/workouts/events', { query: { since, page, pageSize } });
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

  /** The body measurement for a 'YYYY-MM-DD' date, or null if there is none. */
  async getBodyMeasurement(date) {
    try {
      const body = await this.request(`/v1/body_measurements/${encodeURIComponent(date)}`);
      return body?.body_measurement ?? body;
    } catch (error) {
      if (error instanceof HevyApiError && error.status === 404) return null;
      throw error;
    }
  }

  /** Throws HevyApiError with status 409 if the date already has an entry. */
  async createBodyMeasurement(measurement) {
    await this.request('/v1/body_measurements', { method: 'POST', body: measurement });
  }

  /**
   * Replace the entry for a date. Hevy sets every field left out to null,
   * so pass the complete entry. Throws status 404 if the date has no entry.
   */
  async updateBodyMeasurement(date, fields) {
    await this.request(`/v1/body_measurements/${encodeURIComponent(date)}`, { method: 'PUT', body: fields });
  }
}
