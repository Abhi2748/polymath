import { afterEach, describe, expect, it, vi } from "vitest";
import { appNow, ignorePrereqs } from "./dev";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("development helpers", () => {
  it("shift the clock by whole or part days", () => {
    vi.useFakeTimers({ now: new Date("2026-03-10T12:00:00Z") });
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_CLOCK_SHIFT_DAYS", "1.5");
    expect(appNow().toISOString()).toBe("2026-03-12T00:00:00.000Z");
  });

  it("use the real clock when no shift is set", () => {
    vi.useFakeTimers({ now: new Date("2026-03-10T12:00:00Z") });
    vi.stubEnv("DEV_CLOCK_SHIFT_DAYS", "");
    expect(appNow().toISOString()).toBe("2026-03-10T12:00:00.000Z");
  });

  it("reject a shift that is not a number", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_CLOCK_SHIFT_DAYS", "tomorrow");
    expect(() => appNow()).toThrow();
  });

  it("read DEV_IGNORE_PREREQS=1", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_IGNORE_PREREQS", "1");
    expect(ignorePrereqs()).toBe(true);
  });

  it("refuse to run in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_CLOCK_SHIFT_DAYS", "1");
    vi.stubEnv("DEV_IGNORE_PREREQS", "1");
    expect(() => appNow()).toThrow(/production/);
    expect(() => ignorePrereqs()).toThrow(/production/);
  });

  it("do nothing in production when unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_CLOCK_SHIFT_DAYS", "");
    vi.stubEnv("DEV_IGNORE_PREREQS", "");
    expect(() => appNow()).not.toThrow();
    expect(ignorePrereqs()).toBe(false);
  });
});
