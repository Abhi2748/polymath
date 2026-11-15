import { eq } from "drizzle-orm";
import type { SettingsValues } from "@/lib/settingsForm";
import { validTz } from "@/lib/timeZone";
import { db } from "./client";
import { userSettings } from "./schema";

export async function ensureUserSettings(userId: string, tz: string | null | undefined) {
  await db
    .insert(userSettings)
    .values({ userId, tz: validTz(tz) ?? "UTC" })
    .onConflictDoNothing({ target: userSettings.userId });
}

export async function getUserSettings(userId: string): Promise<SettingsValues> {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  return {
    fieldsOff: row?.fieldsOff ?? [],
    sessionMinutes: row?.sessionMinutes ?? 30,
    maxNewPerDay: row?.maxNewPerDay ?? 2,
    tz: row?.tz ?? "UTC",
    plannedReturn: row?.plannedReturn ?? null,
  };
}

export async function saveUserSettings(userId: string, settings: SettingsValues) {
  await db
    .insert(userSettings)
    .values({ userId, ...settings })
    .onConflictDoUpdate({ target: userSettings.userId, set: settings });
}
