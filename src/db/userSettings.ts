import { validTz } from "@/lib/timeZone";
import { db } from "./client";
import { userSettings } from "./schema";

export async function ensureUserSettings(userId: string, tz: string | null | undefined) {
  await db
    .insert(userSettings)
    .values({ userId, tz: validTz(tz) ?? "UTC" })
    .onConflictDoNothing({ target: userSettings.userId });
}
