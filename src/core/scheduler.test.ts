import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Grade } from "./grading";
import { type LessonPack, lessonPackSchema } from "./lesson";
import {
  addDays,
  applyProbe,
  applyReview,
  dueInterval,
  type HistoryRow,
  initialSchedule,
  INTERVALS,
  pickReviewItems,
  probeItem,
  type ReviewProgress,
  sessionDay,
} from "./scheduler";

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

const today = "2026-03-10";

function progress(over: Partial<ReviewProgress> = {}): ReviewProgress {
  return {
    topicId: "lrn01",
    state: "learned",
    box: 3,
    dueAt: today,
    lastReviewedDay: addDays(today, -7),
    successStreak: 1,
    failStreak: 0,
    lapsed: false,
    ...over,
  };
}

describe("review outcome table", () => {
  const cases: {
    name: string;
    grades: [Grade, Grade];
    box: number;
    successStreak: number;
    failStreak: number;
    lapsed: boolean;
  }[] = [
    { name: "both correct: box up one, success + 1, fail reset, lapse cleared", grades: ["correct", "got_it"], box: 4, successStreak: 2, failStreak: 0, lapsed: false },
    { name: "one correct: box and streaks unchanged", grades: ["correct", "wrong"], box: 3, successStreak: 1, failStreak: 1, lapsed: false },
    { name: "one correct with Partly: box and streaks unchanged", grades: ["partly", "got_it"], box: 3, successStreak: 1, failStreak: 1, lapsed: false },
    { name: "none correct: back to box 1, success reset, fail + 1", grades: ["forgot", "partly"], box: 1, successStreak: 0, failStreak: 2, lapsed: true },
  ];

  it.each(cases)("$name", ({ grades, box, successStreak, failStreak, lapsed }) => {
    const before = progress({ failStreak: 1, lapsed: false });
    const after = applyReview(before, grades, today);
    expect(after.box).toBe(box);
    expect(after.successStreak).toBe(successStreak);
    expect(after.failStreak).toBe(failStreak);
    expect(after.lapsed).toBe(lapsed);
    expect(after.lastReviewedDay).toBe(today);
  });

  it("requires exactly two grades", () => {
    expect(() => applyReview(progress(), ["correct"], today)).toThrow();
    expect(() => applyReview(progress(), ["correct", "correct", "correct"], today)).toThrow();
  });
});

describe("long-gap bonus", () => {
  it("both correct after at least twice the box interval moves up two boxes", () => {
    const before = progress({ box: 2, lastReviewedDay: addDays(today, -2 * INTERVALS[2]) });
    expect(applyReview(before, ["correct", "correct"], today).box).toBe(4);
  });

  it("a gap just under twice the interval moves up one", () => {
    const before = progress({ box: 2, lastReviewedDay: addDays(today, -2 * INTERVALS[2] + 1) });
    expect(applyReview(before, ["correct", "correct"], today).box).toBe(3);
  });

  it("does not apply when only one is correct", () => {
    const before = progress({ box: 2, lastReviewedDay: addDays(today, -30) });
    expect(applyReview(before, ["correct", "wrong"], today).box).toBe(2);
  });

  it("does not apply before the first review", () => {
    const before = progress({ box: 1, lastReviewedDay: null });
    expect(applyReview(before, ["correct", "correct"], today).box).toBe(2);
  });
});

describe("box ceiling", () => {
  it("box 8 stays at 8", () => {
    expect(applyReview(progress({ box: 8 }), ["correct", "correct"], today).box).toBe(8);
  });

  it("the long-gap bonus from box 7 stops at 8", () => {
    const before = progress({ box: 7, lastReviewedDay: addDays(today, -2 * INTERVALS[7]) });
    expect(applyReview(before, ["correct", "correct"], today).box).toBe(8);
  });
});

describe("lapse", () => {
  it("two fails in a row set lapsed and drop recalled to learned", () => {
    const first = applyReview(progress({ state: "recalled", successStreak: 4 }), ["wrong", "wrong"], today);
    expect(first.lapsed).toBe(false);
    expect(first.state).toBe("recalled");
    const second = applyReview(first, ["forgot", "partly"], addDays(today, 1));
    expect(second.failStreak).toBe(2);
    expect(second.lapsed).toBe(true);
    expect(second.state).toBe("learned");
  });

  it("a lapse clears on the next review with both correct", () => {
    const lapsed = progress({ box: 1, failStreak: 2, successStreak: 0, lapsed: true, lastReviewedDay: addDays(today, -1) });
    const after = applyReview(lapsed, ["correct", "got_it"], today);
    expect(after.lapsed).toBe(false);
    expect(after.failStreak).toBe(0);
    expect(after.box).toBe(2);
  });

  it("one correct does not clear a lapse", () => {
    const lapsed = progress({ box: 1, failStreak: 2, successStreak: 0, lapsed: true });
    expect(applyReview(lapsed, ["correct", "wrong"], today).lapsed).toBe(true);
  });
});

describe("state rule", () => {
  it("a success streak of 3 sets recalled", () => {
    const after = applyReview(progress({ successStreak: 2 }), ["correct", "correct"], today);
    expect(after.successStreak).toBe(3);
    expect(after.state).toBe("recalled");
  });

  it("a success streak below 3 stays learned", () => {
    expect(applyReview(progress({ successStreak: 1 }), ["correct", "correct"], today).state).toBe("learned");
  });
});

describe("due date", () => {
  it("is the review day plus the new box's interval, shifted by at most 10%", () => {
    for (const topicId of ["lrn01", "phy03", "mth12", "his07", "bio22"]) {
      const after = applyReview(progress({ topicId, box: 5 }), ["correct", "correct"], today);
      expect(after.box).toBe(6);
      const days = dueInterval(topicId, 6);
      expect(days).toBeGreaterThanOrEqual(Math.floor(INTERVALS[6] * 0.9));
      expect(days).toBeLessThanOrEqual(Math.ceil(INTERVALS[6] * 1.1));
      expect(after.dueAt).toBe(addDays(today, days));
    }
  });

  it("the shift is fixed per topic", () => {
    expect(dueInterval("lrn01", 8)).toBe(dueInterval("lrn01", 8));
  });

  it("the shift spreads different topics", () => {
    const days = new Set(["lrn01", "phy03", "mth12", "his07", "bio22", "chm05"].map((t) => dueInterval(t, 8)));
    expect(days.size).toBeGreaterThan(1);
  });

  it("a fail is due one day later", () => {
    expect(applyReview(progress(), ["wrong", "wrong"], today).dueAt).toBe(addDays(today, 1));
  });
});

describe("probe", () => {
  const counts = new Map<string, number>();

  it("a pass keeps the state", () => {
    const recalled = applyProbe(progress({ state: "recalled", successStreak: 4 }), true, today, counts);
    expect(recalled.state).toBe("recalled");
    const learned = applyProbe(progress({ state: "learned", successStreak: 0 }), true, today, counts);
    expect(learned.state).toBe("learned");
  });

  it("a pass follows a review with both correct, including the long-gap bonus", () => {
    const before = progress({ box: 2, successStreak: 1, lastReviewedDay: addDays(today, -2 * INTERVALS[2]) });
    const after = applyProbe(before, true, today, counts);
    expect(after.box).toBe(4);
    expect(after.successStreak).toBe(2);
    expect(after.failStreak).toBe(0);
    expect(after.lapsed).toBe(false);
    expect(after.lastReviewedDay).toBe(today);
  });

  it("a fail drops recalled to learned and never to new", () => {
    const after = applyProbe(progress({ state: "recalled", successStreak: 5, box: 6 }), false, today, counts);
    expect(after.state).toBe("learned");
    expect(after.state).not.toBe("new");
    expect(after.box).toBe(1);
    expect(after.dueAt).toBe(addDays(today, 1));
    expect(after.successStreak).toBe(0);
  });

  it("a fail of a learned topic stays learned", () => {
    const after = applyProbe(progress({ state: "learned" }), false, today, counts);
    expect(after.state).toBe("learned");
    expect(after.box).toBe(1);
  });

  it("spreads passed due dates so no day has more than 10 minutes of reviews", () => {
    const natural = applyReview(progress({ box: 4 }), ["correct", "correct"], today).dueAt;
    const crowded = new Map<string, number>([
      [natural, 15],
      [addDays(natural, 1), 15],
      [addDays(natural, 2), 14],
    ]);
    expect(applyProbe(progress({ box: 4 }), true, today, crowded).dueAt).toBe(addDays(natural, 2));

    const room = new Map<string, number>([[natural, 14]]);
    expect(applyProbe(progress({ box: 4 }), true, today, room).dueAt).toBe(natural);
  });

  it("still dues a fail tomorrow when that day is full", () => {
    const full = new Map<string, number>([[addDays(today, 1), 15]]);
    expect(applyProbe(progress({ state: "recalled" }), false, today, full).dueAt).toBe(addDays(today, 1));
  });
});

describe("picking review items", () => {
  const pack: LessonPack = lessonPackSchema.parse(
    JSON.parse(readFileSync(join(process.cwd(), "data", "lessons", "lrn01.json"), "utf8")),
  );
  const ids = pack.recall_items.map((i) => i.id);

  function asked(itemId: string, at: string, context: HistoryRow["context"] = "review"): HistoryRow {
    return { topicId: pack.topic_id, itemId, askedAt: new Date(at), context };
  }

  it("returns the recall item marked as the probe", () => {
    const item = probeItem(pack);
    expect(item.probe).toBe(true);
    expect(pack.recall_items.filter((i) => i.probe)).toEqual([item]);
  });

  it("returns two distinct items from the pack", () => {
    const picked = pickReviewItems(pack, []);
    expect(picked).toHaveLength(2);
    expect(picked[0].id).not.toBe(picked[1].id);
    picked.forEach((i) => expect(ids).toContain(i.id));
  });

  it("prefers items never asked over items asked before", () => {
    const history = ids.slice(0, -2).map((id, n) => asked(id, `2026-03-0${(n % 9) + 1}T12:00:00Z`));
    expect(pickReviewItems(pack, history).map((i) => i.id).sort()).toEqual(ids.slice(-2).sort());
  });

  it("prefers the items asked longest ago", () => {
    const history = ids.map((id, n) => asked(id, new Date(Date.UTC(2026, 2, 1 + n)).toISOString()));
    expect(pickReviewItems(pack, history).map((i) => i.id)).toEqual([ids[0], ids[1]]);
  });

  it("ignores history from other topics", () => {
    const other = ids.slice(0, 2).map((id) => ({ ...asked(id, "2026-03-09T12:00:00Z"), topicId: "phy01" }));
    expect(pickReviewItems(pack, other)).toEqual(pickReviewItems(pack, []));
  });

  it("never asks the same pair twice in a row", () => {
    // Every item but r1 and r2 was asked recently in a first check or probe, so r1 and r2 are the oldest;
    // but they were also the last review pair.
    const history = [
      asked("r1", "2026-03-01T12:00:00Z"),
      asked("r2", "2026-03-01T12:00:00Z"),
      ...ids.slice(2).map((id) => asked(id, "2026-03-05T12:00:00Z", "probe")),
    ];
    const picked = pickReviewItems(pack, history).map((i) => i.id).sort();
    expect(picked).not.toEqual(["r1", "r2"]);
  });

  it("over many reviews never repeats the previous pair", () => {
    let history: HistoryRow[] = [];
    let previous: string[] = [];
    for (let n = 0; n < 20; n++) {
      const pair = pickReviewItems(pack, history).map((i) => i.id).sort();
      expect(pair).not.toEqual(previous);
      const at = new Date(Date.UTC(2026, 2, 1 + n)).toISOString();
      history = [...history, ...pair.map((id) => asked(id, at))];
      previous = pair;
    }
  });
});
