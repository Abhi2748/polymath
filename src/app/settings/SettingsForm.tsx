"use client";

import { useActionState, useState } from "react";
import { MAX_NEW_PER_DAY, SESSION_MINUTES, type SettingsValues } from "@/lib/settingsForm";
import { saveSettings, type SettingsFormState } from "./actions";

type Realm = { id: string; name: string; fields: { code: string; name: string }[] };

const control = "w-full rounded-xl border border-line bg-background px-4 py-3 text-lg";
const primary = "block w-full rounded-xl bg-accent px-5 py-3 text-center font-medium text-background disabled:opacity-40";

export function SettingsForm({
  initial,
  realms,
  timeZones,
}: {
  initial: SettingsValues;
  realms: Realm[];
  timeZones: string[];
}) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(saveSettings, { status: "idle" });
  const [off, setOff] = useState(() => new Set(initial.fieldsOff));
  const [sessionMinutes, setSessionMinutes] = useState(String(initial.sessionMinutes));
  const [maxNewPerDay, setMaxNewPerDay] = useState(String(initial.maxNewPerDay));
  const [tz, setTz] = useState(initial.tz);
  const [plannedReturn, setPlannedReturn] = useState(initial.plannedReturn ?? "");

  function toggle(code: string, on: boolean) {
    setOff((prev) => {
      const next = new Set(prev);
      if (on) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <form action={action} className="mt-8 space-y-12">
      <section aria-labelledby="pace">
        <h2 id="pace" className="text-2xl font-semibold">
          Pace
        </h2>
        <div className="mt-6 space-y-6">
          <label className="block">
            <span className="text-lg">Session length</span>
            <select
              name="session_minutes"
              value={sessionMinutes}
              onChange={(e) => setSessionMinutes(e.target.value)}
              className={`${control} mt-2`}
            >
              {SESSION_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-lg">New lessons per day</span>
            <select
              name="max_new_per_day"
              value={maxNewPerDay}
              onChange={(e) => setMaxNewPerDay(e.target.value)}
              className={`${control} mt-2`}
            >
              {Array.from({ length: MAX_NEW_PER_DAY + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-lg">Time zone</span>
            <select name="tz" value={tz} onChange={(e) => setTz(e.target.value)} className={`${control} mt-2`}>
              {timeZones.map((z) => (
                <option key={z} value={z}>
                  {z.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <div>
            <label className="block">
              <span className="text-lg">Planned break</span>
              <span className="mt-1 block text-muted">The day you expect to be back. It changes nothing else.</span>
              <input
                type="date"
                name="planned_return"
                value={plannedReturn}
                onChange={(e) => setPlannedReturn(e.target.value)}
                className={`${control} mt-2`}
              />
            </label>
            {plannedReturn && (
              <button
                type="button"
                className="mt-2 text-muted underline underline-offset-4"
                onClick={() => setPlannedReturn("")}
              >
                Clear the date
              </button>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="fields">
        <h2 id="fields" className="text-2xl font-semibold">
          Fields
        </h2>
        <p className="mt-2 text-muted">A field that is off is never offered or reviewed.</p>
        <div className="mt-6 space-y-10">
          {realms.map((realm) => (
            <fieldset key={realm.id}>
              <legend className="text-lg font-medium text-muted">{realm.name}</legend>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {realm.fields.map((f) => {
                  const on = !off.has(f.code);
                  return (
                    <li key={f.code}>
                      <label className="flex items-center justify-between gap-4 py-3">
                        <span>{f.name}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-sm text-muted" aria-hidden>
                            {on ? "On" : "Off"}
                          </span>
                          <input
                            type="checkbox"
                            role="switch"
                            name="field_on"
                            value={f.code}
                            checked={on}
                            onChange={(e) => toggle(f.code, e.target.checked)}
                            className="h-6 w-6 accent-accent"
                          />
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 bg-background pb-6 pt-3">
        <button type="submit" className={primary} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <p className="mt-3 min-h-6 text-center" aria-live="polite">
          {state.status === "saved" && !pending && "Saved."}
          {state.status === "error" && !pending && state.message}
        </p>
      </div>
    </form>
  );
}
