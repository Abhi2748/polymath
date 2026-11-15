"use server";

import { revalidatePath } from "next/cache";
import skeleton from "../../../data/skeleton.json";
import { saveUserSettings } from "@/db/userSettings";
import { requireUserId } from "@/lib/auth";
import { parseSettingsForm } from "@/lib/settingsForm";

export type SettingsFormState = { status: "idle" | "saved" | "error"; message?: string };

export async function saveSettings(_prev: SettingsFormState, form: FormData): Promise<SettingsFormState> {
  const userId = await requireUserId();
  const text = (name: string) => String(form.get(name) ?? "");
  const parsed = parseSettingsForm(
    {
      fieldsOn: form.getAll("field_on").map(String),
      sessionMinutes: text("session_minutes"),
      maxNewPerDay: text("max_new_per_day"),
      tz: text("tz"),
      plannedReturn: text("planned_return"),
    },
    skeleton.fields.map((f) => f.code),
  );
  if (!parsed.ok) return { status: "error", message: parsed.error };

  await saveUserSettings(userId, parsed.settings);
  revalidatePath("/", "layout");
  return { status: "saved" };
}
