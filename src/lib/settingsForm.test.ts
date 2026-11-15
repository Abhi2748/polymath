import { describe, expect, it } from "vitest";
import { parseSettingsForm, SESSION_MINUTES, type SettingsFormInput } from "./settingsForm";

const codes = ["LRN", "THK", "MAT", "PHY"];

const input: SettingsFormInput = {
  fieldsOn: ["LRN", "THK", "MAT", "PHY"],
  sessionMinutes: "30",
  maxNewPerDay: "2",
  tz: "Europe/London",
  plannedReturn: "",
};

const parse = (over: Partial<SettingsFormInput> = {}) => parseSettingsForm({ ...input, ...over }, codes);

describe("parseSettingsForm", () => {
  it("accepts the defaults", () => {
    expect(parse()).toEqual({
      ok: true,
      settings: { fieldsOff: [], sessionMinutes: 30, maxNewPerDay: 2, tz: "Europe/London", plannedReturn: null },
    });
  });

  it("turns off every field whose switch is not sent, in skeleton order", () => {
    const r = parse({ fieldsOn: ["THK"] });
    expect(r.ok && r.settings.fieldsOff).toEqual(["LRN", "MAT", "PHY"]);
  });

  it("ignores switches for fields that do not exist", () => {
    const r = parse({ fieldsOn: [...codes, "XYZ"] });
    expect(r.ok && r.settings.fieldsOff).toEqual([]);
  });

  it.each(["0", "1", "2", "3"])("accepts %s new lessons per day", (n) => {
    const r = parse({ maxNewPerDay: n });
    expect(r.ok && r.settings.maxNewPerDay).toBe(Number(n));
  });

  it.each(["4", "-1", "1.5", "", "two"])("refuses %j new lessons per day", (n) => {
    expect(parse({ maxNewPerDay: n }).ok).toBe(false);
  });

  it("accepts only the offered session lengths", () => {
    for (const m of SESSION_MINUTES) expect(parse({ sessionMinutes: String(m) }).ok).toBe(true);
    expect(parse({ sessionMinutes: "17" }).ok).toBe(false);
  });

  it("refuses an unknown time zone", () => {
    expect(parse({ tz: "Mars/Olympus" }).ok).toBe(false);
  });

  it("keeps a planned break date and clears it when empty", () => {
    const r = parse({ plannedReturn: "2026-12-24" });
    expect(r.ok && r.settings.plannedReturn).toBe("2026-12-24");
    const cleared = parse({ plannedReturn: "  " });
    expect(cleared.ok && cleared.settings.plannedReturn).toBeNull();
  });

  it("refuses a planned break that is not a real date", () => {
    expect(parse({ plannedReturn: "2026-02-30" }).ok).toBe(false);
    expect(parse({ plannedReturn: "24/12/2026" }).ok).toBe(false);
  });
});
