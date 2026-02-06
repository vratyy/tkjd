/**
 * Local-timezone-safe date utilities for week calculations.
 * 
 * CRITICAL: Using `new Date("2026-02-06")` parses as UTC midnight,
 * which in CET becomes the previous day at 23:00. This causes records
 * at week boundaries to be assigned to the wrong week.
 * 
 * These utilities always use LOCAL date components to prevent data loss.
 */

/**
 * Parse a YYYY-MM-DD string into a local Date (noon to avoid DST edge cases).
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Format a Date to YYYY-MM-DD using local components (no UTC shift).
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculate ISO 8601 calendar week from a Date using local components.
 * This avoids the UTC-shift bug that causes boundary records to be misclassified.
 */
export function getISOWeekLocal(date: Date): number {
  // Use local date components to construct the calculation date
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNum = d.getDay() || 7; // Sunday = 7
  d.setDate(d.getDate() + 4 - dayNum); // Nearest Thursday
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Get ISO week year (the year of the Thursday of the week).
 */
export function getISOWeekYear(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  return d.getFullYear();
}

/**
 * Check if a date string (YYYY-MM-DD) belongs to a given ISO calendar week and year.
 * Uses LOCAL date parsing to prevent timezone-induced misclassification.
 */
export function isDateInWeek(dateStr: string, calendarWeek: number, year: number): boolean {
  const date = parseLocalDate(dateStr);
  const week = getISOWeekLocal(date);
  const weekYear = getISOWeekYear(date);
  return week === calendarWeek && weekYear === year;
}
