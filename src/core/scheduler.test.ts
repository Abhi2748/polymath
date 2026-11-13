import { describe, expect, it } from "vitest";
import { addDays, initialSchedule, sessionDay } from "./scheduler";

describe("session day", () => {
  const tz = "America/Chicago";

  it("01:30 local time belongs to the previous day", () => {
    expect(sessionDay(new Date("2026-01-10T01:30:00-06:00"), tz)).toBe("2026-01-09");
  });

  it("04:30 local time belongs to the current day", () => {
    expect(sessionDay(new Date("2026-01-10T04:30:00-06:00"), tz)).toBe("2026-01-10");
  });

  it("uses the time zone, not UTC", () => {
    // 23:00 in Chicago is 05:00 UTC the next day.
    expect(sessionDay(new Date("2026-01-10T23:00:00-06:00"), tz)).toBe("2026-01-10");
  });
});

describe("addDays", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("initial schedule", () => {
  it("a newly learned topic goes into box 1, due one day later", () => {
    expect(initialSchedule("2026-03-10")).toEqual({ box: 1, dueAt: "2026-03-11" });
  });
});
