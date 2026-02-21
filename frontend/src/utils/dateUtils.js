/**
 * Returns today's date as a YYYY-MM-DD string in the user's local timezone.
 *
 * Using new Date().toISOString() returns the UTC date, which can be off by
 * one day for users whose local time is behind UTC (e.g. someone in UTC-5 at
 * 9 PM local is already the next calendar day in UTC).
 */
export function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns a Date object's date as a YYYY-MM-DD string in the user's local
 * timezone. Useful when you have a Date that was created via arithmetic
 * (e.g. week navigation) and need to convert it to a date string without
 * accidentally shifting the day due to a UTC conversion.
 */
export function localDateStringFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
