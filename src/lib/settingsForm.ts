import { validTz } from "./timeZone";

export const SESSION_MINUTES = [15, 20, 30, 40, 60] as const;
export const MAX_NEW_PER_DAY = 3;

export type SettingsFormInput = {
  fieldsOn: string[];
  sessionMinutes: string;
  maxNewPerDay: string;
  tz: string;
  plannedReturn: string;
};

export type SettingsValues = {
  fieldsOff: string[];
  sessionMinutes: number;
  maxNewPerDay: number;
  tz: string;
  plannedReturn: string | null;
};

export type ParsedSettings = { ok: true; settings: SettingsValues } | { ok: false; error: string };

// fieldCodes is every field in skeleton order. A field is off unless its switch was sent.
export function parseSettingsForm(input: SettingsFormInput, fieldCodes: string[]): ParsedSettings {
  const on = new Set(input.fieldsOn);
  const fieldsOff = fieldCodes.filter((code) => !on.has(code));

  const sessionMinutes = Number(input.sessionMinutes);
  if (!(SESSION_MINUTES as readonly number[]).includes(sessionMinutes)) {
    return { ok: false, error: "Choose one of the session lengths." };
  }

  const maxNewPerDay = /^\d$/.test(input.maxNewPerDay) ? Number(input.maxNewPerDay) : NaN;
  if (!(maxNewPerDay >= 0 && maxNewPerDay <= MAX_NEW_PER_DAY)) {
    return { ok: false, error: `New lessons per day must be 0 to ${MAX_NEW_PER_DAY}.` };
  }

  const tz = validTz(input.tz.trim());
  if (!tz) return { ok: false, error: "That time zone is not recognised." };

  const day = input.plannedReturn.trim();
  if (day && !isCalendarDay(day)) return { ok: false, error: "The planned break date is not a real date." };

  return { ok: true, settings: { fieldsOff, sessionMinutes, maxNewPerDay, tz, plannedReturn: day || null } };
}

function isCalendarDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}
