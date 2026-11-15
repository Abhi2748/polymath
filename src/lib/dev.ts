const DAY_MS = 24 * 60 * 60 * 1000;

function devOnly(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is a development setting and must not be set in production. Remove it.`);
  }
  return value;
}

// The current time, moved by DEV_CLOCK_SHIFT_DAYS (may be fractional or negative) in development.
export function appNow(): Date {
  const shift = devOnly("DEV_CLOCK_SHIFT_DAYS");
  if (shift === undefined) return new Date();
  const days = Number(shift);
  if (!Number.isFinite(days)) throw new Error(`DEV_CLOCK_SHIFT_DAYS must be a number, got "${shift}"`);
  return new Date(Date.now() + days * DAY_MS);
}

export function ignorePrereqs(): boolean {
  return devOnly("DEV_IGNORE_PREREQS") === "1";
}
