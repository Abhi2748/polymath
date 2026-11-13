const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_START_HOURS = 4;

// The local date of (now minus 4 hours) in the user's time zone, as YYYY-MM-DD.
export function sessionDay(now: Date, tz: string): string {
  const shifted = new Date(now.getTime() - DAY_START_HOURS * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    shifted,
  );
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

export function initialSchedule(today: string): { box: 1; dueAt: string } {
  return { box: 1, dueAt: addDays(today, 1) };
}
