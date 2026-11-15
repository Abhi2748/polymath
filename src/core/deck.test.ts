import { describe, expect, it } from "vitest";
import {
  advanceSession,
  buildDeck,
  type Deck,
  type DeckLesson,
  type DeckOptions,
  type DeckProgress,
  type DeckSettings,
  type DeckSkeleton,
  type DeckStep,
  nextDue,
  type SessionRecord,
  type SessionSummary,
  sessionComplete,
  showWelcomeBack,
} from "./deck";
import { addDays } from "./scheduler";

const now = new Date("2026-03-10T12:00:00Z");
const today = "2026-03-10";
const settings: DeckSettings = { tz: "UTC", maxNewPerDay: 2, fieldsOff: [], sessionMinutes: 30 };

function topic(id: string, field: string, season: number, seq: number, prereqs: string[] = []) {
  return { id, field, season, seq, prereqs };
}

const skeleton: DeckSkeleton = {
  fields: [
    { code: "LRN", kind: "starter" },
    { code: "THK", kind: "spine" },
    { code: "MAT", kind: "field" },
    { code: "PHY", kind: "field" },
    { code: "HIS", kind: "spine" },
    { code: "ART", kind: "field" },
    { code: "BIO", kind: "field" },
  ],
  topics: [
    topic("lrn01", "LRN", 1, 1),
    topic("lrn02", "LRN", 1, 2, ["lrn01"]),
    topic("lrn03", "LRN", 1, 3),
    topic("lrn04", "LRN", 1, 4),
    topic("thk01", "THK", 1, 1),
    topic("thk02", "THK", 1, 2, ["thk01"]),
    topic("mat01", "MAT", 1, 1),
    topic("mat02", "MAT", 1, 2),
    topic("phy01", "PHY", 1, 1),
    topic("his01", "HIS", 1, 1),
    topic("his02", "HIS", 1, 2, ["his01"]),
    topic("art01", "ART", 1, 1),
    topic("art02", "ART", 1, 2),
    topic("bio01", "BIO", 2, 1),
  ],
};

// lrn04 and art02 have no lesson pack.
const unwritten = new Set(["lrn04", "art02"]);
const lessons: DeckLesson[] = skeleton.topics.filter((t) => !unwritten.has(t.id)).map((t) => ({ topicId: t.id, estMinutes: 8 }));

function row(topicId: string, over: Partial<DeckProgress> = {}): DeckProgress {
  return { topicId, state: "learned", dueAt: addDays(today, 10), lapsed: false, parked: false, ...over };
}

const starterDone = ["lrn01", "lrn02", "lrn03"].map((id) => row(id));

function summary(
  steps: DeckStep[] = [],
  reviews: SessionSummary["reviews"] = [],
  probes: NonNullable<SessionSummary["probes"]> = [],
  lessonOutcomes: SessionSummary["lessons"] = [],
): SessionSummary {
  return { steps: [...steps, { kind: "end" }], done: steps.length, reviews, lessons: lessonOutcomes, probes };
}

function session(daysAgo: number, over: Partial<SessionRecord> = {}): SessionRecord {
  return { sessionDay: addDays(today, -daysAgo), kind: "full", completed: true, summary: summary(), ...over };
}

function newLesson(topicId: string): DeckStep {
  return { kind: "lesson", topicId, isNew: true };
}

function build(
  over: {
    settings?: Partial<DeckSettings>;
    progress?: DeckProgress[];
    history?: SessionRecord[];
    skeleton?: DeckSkeleton;
    lessons?: DeckLesson[];
    options?: DeckOptions;
  } = {},
): Deck {
  return buildDeck(
    now,
    { ...settings, ...over.settings },
    over.progress ?? [],
    over.history ?? [],
    over.skeleton ?? skeleton,
    over.lessons ?? lessons,
    over.options,
  );
}

const newIds = (deck: Deck) => deck.steps.flatMap((s) => (s.kind === "lesson" && s.isNew ? [s.topicId] : []));
const reviewIds = (deck: Deck) => deck.steps.flatMap((s) => (s.kind === "review" ? [s.topicId] : []));
const probeIds = (deck: Deck) => deck.steps.flatMap((s) => (s.kind === "probe" ? [s.topicId] : []));
const fieldOf = (id: string) => skeleton.topics.find((t) => t.id === id)!.field;

// Twenty-five extra season 1 topics, all learned, for tests that need many reviews.
const extraIds = Array.from({ length: 25 }, (_, n) => `geo${String(n + 1).padStart(2, "0")}`);
const withExtra: DeckSkeleton = {
  fields: [...skeleton.fields, { code: "GEO", kind: "field" }],
  topics: [...skeleton.topics, ...extraIds.map((id, n) => topic(id, "GEO", 1, n + 1))],
};
const extraLessons = [...lessons, ...extraIds.map((topicId) => ({ topicId, estMinutes: 8 }))];
function dueExtra(count: number): DeckProgress[] {
  return extraIds.map((id, n) => row(id, { dueAt: n < count ? addDays(today, -1 - n) : addDays(today, 5) }));
}

describe("deck basics", () => {
  it("works out the session day and is in normal mode", () => {
    const deck = build();
    expect(deck.sessionDay).toBe(today);
    expect(deck.mode).toBe("normal");
  });

  it("always ends with the end screen", () => {
    expect(build().steps.at(-1)).toEqual({ kind: "end" });
    const nothing = build({ settings: { maxNewPerDay: 0 } });
    expect(nothing.steps).toEqual([{ kind: "end" }]);
  });

  it("puts reviews first, then lessons in progress, then new lessons", () => {
    const deck = build({
      progress: [...starterDone.slice(0, 2), row("lrn03", { dueAt: today }), row("mat01", { state: "in_progress" })],
      settings: { maxNewPerDay: 1 },
    });
    expect(deck.steps.map((s) => s.kind)).toEqual(["review", "lesson", "lesson", "end"]);
    expect(deck.steps[1]).toEqual({ kind: "lesson", topicId: "mat01", isNew: false });
    expect(deck.steps[2]).toMatchObject({ isNew: true });
  });

  it("estimates 40 seconds per review plus each lesson's minutes, rounded up", () => {
    const deck = build({
      progress: [row("lrn01", { dueAt: today }), row("lrn02", { dueAt: today }), row("lrn03", { dueAt: today })],
      settings: { maxNewPerDay: 1 },
    });
    expect(reviewIds(deck)).toHaveLength(3);
    expect(newIds(deck)).toHaveLength(1);
    expect(deck.minutes).toBe(2 + 8);
  });
});

describe("reviews", () => {
  it("takes due topics oldest first, up to 10 minutes", () => {
    const deck = build({ skeleton: withExtra, lessons: extraLessons, progress: [...starterDone, ...dueExtra(20)] });
    expect(reviewIds(deck)).toEqual(extraIds.slice(0, 20).reverse().slice(0, 15));
  });

  it("leaves out parked topics and topics not yet due", () => {
    const deck = build({
      progress: [row("lrn01", { dueAt: today }), row("lrn02", { dueAt: today, parked: true }), row("lrn03")],
    });
    expect(reviewIds(deck)).toEqual(["lrn01"]);
  });
});

describe("starter first", () => {
  it("offers the starter topics before anything else, in sequence", () => {
    expect(newIds(build())).toEqual(["lrn01", "lrn03"]);
  });

  it("may offer two starter lessons in one day", () => {
    expect(newIds(build({ progress: [row("lrn01")] }))).toEqual(["lrn02", "lrn03"]);
  });

  it("waits for the starter while a starter lesson is in progress", () => {
    const deck = build({ progress: [row("lrn01"), row("lrn02"), row("lrn03", { state: "in_progress" })] });
    expect(newIds(deck)).toEqual([]);
  });

  it("ignores starter topics that have no lesson pack", () => {
    const ids = newIds(build({ progress: starterDone }));
    expect(ids).not.toContain("lrn04");
    expect(ids.length).toBeGreaterThan(0);
  });
});

describe("new lessons", () => {
  const noSpines = { fieldsOff: ["THK", "HIS"], maxNewPerDay: 3 };

  it("never offers two lessons from one field in a day", () => {
    // MAT has two unlocked topics.
    const ids = newIds(build({ progress: starterDone, settings: noSpines }));
    expect(ids).toEqual(["mat01", "phy01", "art01"]);
  });

  it("skips a field already used by an earlier session today", () => {
    const earlier = session(0, { summary: summary([newLesson("mat01")]) });
    const ids = newIds(build({ progress: [...starterDone, row("mat01")], history: [earlier], settings: noSpines }));
    expect(ids).toEqual(["phy01", "art01"]);
  });

  it("offers at most three new lessons per session day, counting earlier sessions", () => {
    const earlier = session(0, { summary: summary([newLesson("thk01"), newLesson("his01")]) });
    const ids = newIds(
      build({ progress: [...starterDone, row("thk01"), row("his01")], history: [earlier], settings: { maxNewPerDay: 3 } }),
    );
    expect(ids).toHaveLength(1);
  });

  it("rotates to the field studied least recently", () => {
    const history = [
      session(0, { kind: "short" }),
      session(3, { summary: summary([newLesson("mat01")]) }),
      session(1, { summary: summary([newLesson("phy01")]) }),
      session(2, { summary: summary([newLesson("thk01"), newLesson("his01")]) }),
    ];
    const progress = [...starterDone, row("mat01"), row("phy01"), row("thk01"), row("his01")];
    // ART has never been studied, then MAT is the oldest.
    expect(newIds(build({ progress, history }))).toEqual(["art01", "mat02"]);
  });

  it("offers nothing from a switched-off field", () => {
    const deck = build({
      progress: [...starterDone, row("mat01", { dueAt: today })],
      settings: { fieldsOff: ["MAT", "THK", "HIS"], maxNewPerDay: 3 },
    });
    expect(deck.steps.some((s) => "topicId" in s && fieldOf(s.topicId) === "MAT")).toBe(false);
    expect(newIds(deck).length).toBeGreaterThan(0);
  });

  it("does not resume a lesson in progress from a switched-off field", () => {
    const deck = build({
      progress: [...starterDone, row("mat01", { state: "in_progress" })],
      settings: { fieldsOff: ["MAT"] },
    });
    expect(deck.steps.some((s) => "topicId" in s && fieldOf(s.topicId) === "MAT")).toBe(false);
  });

  it("offers nothing at all from the starter when it is switched off", () => {
    const deck = build({ settings: { fieldsOff: ["LRN"], maxNewPerDay: 3 } });
    expect(deck.steps.some((s) => "topicId" in s && fieldOf(s.topicId) === "LRN")).toBe(false);
    expect(newIds(deck).length).toBeGreaterThan(0);
  });

  it("never offers a topic without a lesson pack", () => {
    const deck = build({ progress: [...starterDone, row("art01")], settings: { maxNewPerDay: 3 } });
    expect(newIds(deck)).not.toContain("art02");
    const unlockedAll = build({ progress: [], settings: { maxNewPerDay: 3 }, options: { ignorePrereqs: true } });
    expect(newIds(unlockedAll)).not.toContain("lrn04");
  });

  it("treats prerequisites as met when asked to ignore them", () => {
    expect(newIds(build({ options: { ignorePrereqs: true } }))).toEqual(["lrn01", "lrn02"]);
  });
});

describe("current season", () => {
  const season1Written = skeleton.topics.filter((t) => t.season === 1 && !unwritten.has(t.id)).map((t) => t.id);

  it("does not offer a later season while the current one has unlearned topics", () => {
    expect(newIds(build({ progress: starterDone, settings: { maxNewPerDay: 3 } }))).not.toContain("bio01");
  });

  it("holds the next season for the consolidation sessions after this one is finished", () => {
    expect(newIds(build({ progress: season1Written.map((id) => row(id)) }))).toEqual([]);
  });

  it("offers nothing rather than skipping ahead when the current season's topics are locked", () => {
    const progress = season1Written.filter((id) => id !== "thk02").map((id) => row(id, { lapsed: id === "thk01" }));
    expect(newIds(build({ progress }))).toEqual([]);
  });
});

describe("spines", () => {
  const progress = [...starterDone, row("thk01"), row("his01")];
  const tookThk = session(20, { summary: summary([newLesson("thk01")]) });
  const tookHis = session(20, { summary: summary([newLesson("his01")]) });
  const fullSessions = (n: number) => Array.from({ length: n }, (_, i) => session(i + 1));

  it("offers Thinking Tools, then World History, at once when none has been taken", () => {
    expect(newIds(build({ progress: starterDone }))).toEqual(["thk01", "his01"]);
  });

  it("offers a Thinking Tools lesson after 7 full sessions", () => {
    expect(newIds(build({ progress, history: [tookThk, tookHis, ...fullSessions(6)] }))).not.toContain("thk02");
    expect(newIds(build({ progress, history: [tookThk, tookHis, ...fullSessions(7)] }))).toContain("thk02");
  });

  it("offers a World History lesson after 10 full sessions", () => {
    expect(newIds(build({ progress, history: [tookThk, tookHis, ...fullSessions(9)] }))).not.toContain("his02");
    expect(newIds(build({ progress, history: [tookThk, tookHis, ...fullSessions(10)] }))).toContain("his02");
  });

  it("counts only completed full sessions", () => {
    const history = [
      tookThk,
      tookHis,
      ...fullSessions(6),
      session(0, { kind: "short" }),
      session(0, { completed: false }),
    ];
    expect(newIds(build({ progress, history }))).not.toContain("thk02");
  });
});

describe("overload guard", () => {
  it("allows new lessons when today's due reviews fit in 15 minutes", () => {
    const deck = build({ skeleton: withExtra, lessons: extraLessons, progress: [...starterDone, ...dueExtra(22)] });
    expect(newIds(deck).length).toBeGreaterThan(0);
  });

  it("blocks new lessons when today's due reviews would take more than 15 minutes", () => {
    const deck = build({ skeleton: withExtra, lessons: extraLessons, progress: [...starterDone, ...dueExtra(23)] });
    expect(newIds(deck)).toEqual([]);
  });

  const reviews = (both: number, total: number) =>
    Array.from({ length: total }, (_, n) => ({ topicId: "lrn01", correct: n < both ? 2 : 1 }));

  it("blocks new lessons when under 70% of the last 7 sessions' reviews had both right", () => {
    const history = [session(1, { summary: summary([], reviews(6, 10)) })];
    expect(newIds(build({ progress: starterDone, history }))).toEqual([]);
  });

  it("allows new lessons at 70%", () => {
    const history = [session(1, { summary: summary([], reviews(7, 10)) })];
    expect(newIds(build({ progress: starterDone, history })).length).toBeGreaterThan(0);
  });

  it("does not apply the rate before there have been 10 reviews", () => {
    const history = [session(1, { summary: summary([], reviews(0, 9)) })];
    expect(newIds(build({ progress: starterDone, history })).length).toBeGreaterThan(0);
  });

  it("looks only at the last 7 sessions", () => {
    const old = session(8, { summary: summary([], reviews(0, 20)) });
    const recent = Array.from({ length: 7 }, (_, i) => session(i + 1, { kind: "short", summary: summary([], reviews(2, 2)) }));
    expect(newIds(build({ progress: starterDone, history: [old, ...recent] })).length).toBeGreaterThan(0);
  });
});

describe("lessons in progress", () => {
  it("resumes lessons in progress", () => {
    const deck = build({ progress: [...starterDone, row("mat01", { state: "in_progress" })] });
    expect(deck.steps).toContainEqual({ kind: "lesson", topicId: "mat01", isNew: false });
  });

  it("offers no new lesson while two are in progress", () => {
    const progress = [...starterDone, row("mat01", { state: "in_progress" }), row("phy01", { state: "in_progress" })];
    expect(newIds(build({ progress }))).toEqual([]);
  });

  it("still offers new lessons while one is in progress", () => {
    const progress = [...starterDone, row("mat01", { state: "in_progress" })];
    expect(newIds(build({ progress }))).toHaveLength(2);
  });
});

describe("short day", () => {
  it("has reviews only, up to 15 minutes", () => {
    const deck = build({
      skeleton: withExtra,
      lessons: extraLessons,
      progress: [...starterDone, ...dueExtra(25), row("mat01", { state: "in_progress" })],
      options: { kind: "short" },
    });
    expect(deck.kind).toBe("short");
    expect(deck.steps.every((s) => s.kind === "review" || s.kind === "end")).toBe(true);
    expect(reviewIds(deck)).toHaveLength(22);
  });
});

describe("session progress", () => {
  const plan = summary([{ kind: "review", topicId: "lrn01" }, newLesson("mat01")]);
  const fresh: SessionSummary = { ...plan, done: 0 };

  it("moves on when the current step is finished", () => {
    const after = advanceSession(fresh, { kind: "review", topicId: "lrn01", correct: 2 });
    expect(after).toMatchObject({ done: 1, reviews: [{ topicId: "lrn01", correct: 2 }] });
    expect(sessionComplete(after!)).toBe(false);
  });

  it("is complete when only the end screen is left", () => {
    const one = advanceSession(fresh, { kind: "review", topicId: "lrn01", correct: 1 })!;
    const two = advanceSession(one, { kind: "lesson", topicId: "mat01", outcome: "passed" })!;
    expect(two.lessons).toEqual([{ topicId: "mat01", outcome: "passed" }]);
    expect(sessionComplete(two)).toBe(true);
  });

  it("ignores a result that is not for the current step", () => {
    expect(advanceSession(fresh, { kind: "lesson", topicId: "mat01", outcome: "passed" })).toBeNull();
    expect(advanceSession(fresh, { kind: "review", topicId: "lrn02", correct: 2 })).toBeNull();
  });
});

describe("modes", () => {
  // Section 13: 3, 4, 14 and 15 days away pick the right mode.
  it.each([
    [3, "normal"],
    [4, "catch_up"],
    [14, "catch_up"],
    [15, "return_check"],
  ] as const)("%i days away is %s", (days, mode) => {
    expect(build({ history: [session(days)] }).mode).toBe(mode);
  });
});

describe("catch-up", () => {
  const away = [session(4)];

  it("gives reviews half the session and holds new lessons until what is due fits in 10 minutes", () => {
    const blocked = build({
      skeleton: withExtra,
      lessons: extraLessons,
      progress: [...starterDone, ...dueExtra(25)],
      history: away,
    });
    // Half of 30 minutes is 15 minutes, which holds 22 reviews at 40 seconds.
    expect(blocked.mode).toBe("catch_up");
    expect(reviewIds(blocked)).toHaveLength(22);
    expect(newIds(blocked)).toEqual([]);

    const open = build({
      skeleton: withExtra,
      lessons: extraLessons,
      progress: [...starterDone, ...dueExtra(15)],
      history: away,
    });
    expect(reviewIds(open)).toHaveLength(15);
    expect(newIds(open).length).toBeGreaterThan(0);
  });

  it("takes the half from the session length setting", () => {
    const deck = build({
      skeleton: withExtra,
      lessons: extraLessons,
      progress: [...starterDone, ...dueExtra(25)],
      history: away,
      settings: { sessionMinutes: 20 },
    });
    expect(reviewIds(deck)).toHaveLength(15);
  });

  it("does not use the normal-mode rate guard", () => {
    const history = [session(4, { summary: summary([], Array.from({ length: 10 }, () => ({ topicId: "lrn01", correct: 0 }))) })];
    expect(newIds(build({ progress: starterDone, history })).length).toBeGreaterThan(0);
  });

  it("keeps a short day as 15 minutes of reviews", () => {
    const deck = build({
      skeleton: withExtra,
      lessons: extraLessons,
      progress: [...starterDone, ...dueExtra(25)],
      history: away,
      settings: { sessionMinutes: 60 },
      options: { kind: "short" },
    });
    expect(deck.mode).toBe("catch_up");
    expect(deck.steps.every((s) => s.kind === "review" || s.kind === "end")).toBe(true);
    expect(reviewIds(deck)).toHaveLength(22);
    const full = build({
      skeleton: withExtra,
      lessons: extraLessons,
      progress: [...starterDone, ...dueExtra(25)],
      history: away,
      settings: { sessionMinutes: 60 },
    });
    expect(reviewIds(full)).toHaveLength(25);
  });
});

describe("consolidation", () => {
  const done = season1Written();
  // The season finished 20 days ago. Sessions after that day are the consolidation window.
  const finished = session(20, {
    summary: summary(
      [{ kind: "lesson", topicId: "art01", isNew: true }],
      [],
      [],
      [{ topicId: "art01", outcome: "passed" }],
    ),
  });
  const later = (n: number) => [finished, ...Array.from({ length: n }, (_, i) => session(i + 1))];

  function season1Written(): DeckProgress[] {
    return skeleton.topics.filter((t) => t.season === 1 && !unwritten.has(t.id)).map((t) => row(t.id));
  }

  it("offers no new lessons for the next 7 full sessions", () => {
    expect(newIds(build({ progress: done, history: later(6) }))).toEqual([]);
    expect(newIds(build({ progress: done, history: later(7) }))).toEqual(["bio01"]);
  });

  it("does not count a short session toward the 7", () => {
    const history = [...later(6), session(0, { kind: "short" })];
    expect(newIds(build({ progress: done, history }))).toEqual([]);
  });

  it("does not let a refresher move the end of the season", () => {
    const refresher = session(1, {
      summary: summary(
        [{ kind: "lesson", topicId: "art01", isNew: false, refresher: true }],
        [],
        [],
        [{ topicId: "art01", outcome: "passed" }],
      ),
    });
    expect(newIds(build({ progress: done, history: [finished, refresher, ...Array.from({ length: 6 }, (_, i) => session(i + 2))] }))).toEqual(["bio01"]);
  });
});

describe("return check", () => {
  const prereqSkeleton: DeckSkeleton = {
    fields: [
      { code: "LRN", kind: "starter" },
      { code: "MAT", kind: "field" },
      { code: "PHY", kind: "field" },
    ],
    topics: [
      topic("lrn01", "LRN", 1, 1),
      topic("mat01", "MAT", 1, 1),
      topic("mat02", "MAT", 1, 2, ["mat01"]),
      topic("phy01", "PHY", 1, 1),
      topic("phy02", "PHY", 1, 2),
    ],
  };
  const prereqLessons: DeckLesson[] = prereqSkeleton.topics.map((t) => ({ topicId: t.id, estMinutes: 8 }));
  const learned = [
    row("lrn01", { lastReviewedDay: addDays(today, -2) }),
    row("mat01", { lastReviewedDay: addDays(today, -1) }),
    row("phy01", { lastReviewedDay: addDays(today, -400) }),
  ];

  it("probes the prerequisites of the next lessons first", () => {
    const deck = build({
      skeleton: prereqSkeleton,
      lessons: prereqLessons,
      progress: learned,
      history: [session(20)],
      settings: { maxNewPerDay: 1 },
    });
    expect(deck.mode).toBe("return_check");
    // mat01 was reviewed yesterday, phy01 much earlier. mat01 still comes first because mat02 is next.
    expect(probeIds(deck)).toEqual(["mat01", "phy01", "lrn01"]);
    expect(newIds(deck)).toEqual([]);
  });

  it("resumes new lessons before the queue is empty once those prerequisites have passed", () => {
    const passed = session(1, {
      summary: summary([{ kind: "probe", topicId: "mat01" }], [], [{ topicId: "mat01", passed: true }]),
    });
    const deck = build({
      skeleton: prereqSkeleton,
      lessons: prereqLessons,
      progress: learned,
      history: [session(20), passed],
      settings: { maxNewPerDay: 1 },
    });
    expect(deck.mode).toBe("return_check");
    expect(newIds(deck)).toEqual(["mat02"]);
    expect(probeIds(deck).length).toBeGreaterThan(0);
    expect(probeIds(deck)).not.toContain("mat01");
  });

  it("asks up to 15 minutes of probes", () => {
    const pile = learnedPile(50);
    const deck = build({ ...pile, history: [session(20)], settings: { maxNewPerDay: 0 } });
    expect(probeIds(deck)).toHaveLength(45);
    expect(deck.minutes).toBe(15);
  });

  it("keeps going the next day until every learned topic has been probed", () => {
    const deck = build({
      progress: learned,
      history: [
        session(20),
        session(1, { summary: summary([{ kind: "probe", topicId: "lrn01" }], [], [{ topicId: "lrn01", passed: true }]) }),
      ],
      skeleton: prereqSkeleton,
      lessons: prereqLessons,
      settings: { maxNewPerDay: 1 },
    });
    expect(deck.mode).toBe("return_check");
    expect(probeIds(deck)).not.toContain("lrn01");
  });

  it("starts the next review of a failed probe with the lesson cards", () => {
    const deck = build({
      progress: [row("lrn01", { dueAt: today, state: "learned" })],
      history: [
        session(2, {
          summary: summary([{ kind: "probe", topicId: "lrn01" }], [], [{ topicId: "lrn01", passed: false }]),
        }),
      ],
    });
    const reviewAt = deck.steps.findIndex((s) => s.kind === "review" && s.topicId === "lrn01");
    expect(deck.steps[reviewAt - 1]).toEqual({ kind: "lesson", topicId: "lrn01", isNew: false, refresher: true });
  });

  it("drops the refresher once that review has happened", () => {
    const deck = build({
      progress: [row("lrn01", { dueAt: today })],
      history: [
        session(3, {
          summary: summary([{ kind: "probe", topicId: "lrn01" }], [], [{ topicId: "lrn01", passed: false }]),
        }),
        session(1, { summary: summary([{ kind: "review", topicId: "lrn01" }], [{ topicId: "lrn01", correct: 1 }]) }),
      ],
    });
    expect(deck.steps.some((s) => s.kind === "lesson" && s.refresher)).toBe(false);
  });

  it("caps the first sessions after 60 days, then the next two, then the setting", () => {
    const pile = learnedPile(50);
    const first = build({ ...pile, history: [session(70)], settings: { sessionMinutes: 60 } });
    expect(first.mode).toBe("return_check");
    expect(probeIds(first)).toHaveLength(45);
    expect(newIds(first)).toEqual([]);
    expect(first.minutes).toBeLessThanOrEqual(20);

    const third = build({
      ...pile,
      history: [session(80), session(3), session(2)],
      settings: { sessionMinutes: 60 },
    });
    expect(third.mode).toBe("return_check");
    expect(probeIds(third)).toHaveLength(45);
    expect(newIds(third)).toEqual(["thk01", "his01"]);
    expect(third.minutes).toBeLessThanOrEqual(40);
  });
});

function learnedPile(count: number) {
  const ids = Array.from({ length: count }, (_, n) => `pile${String(n).padStart(2, "0")}`);
  const pileSkeleton: DeckSkeleton = {
    fields: [...skeleton.fields, { code: "PILE", kind: "field" }],
    topics: [...skeleton.topics, ...ids.map((id, n) => topic(id, "PILE", 1, n + 1))],
  };
  return {
    skeleton: pileSkeleton,
    lessons: [...lessons, ...ids.map((topicId) => ({ topicId, estMinutes: 8 }))],
    progress: [...starterDone, ...ids.map((id) => row(id, { dueAt: addDays(today, 30) }))],
  };
}

describe("welcome back", () => {
  it("is said on the planned day when no session since then has been completed", () => {
    expect(showWelcomeBack(today, today, [session(5)])).toBe(true);
    expect(showWelcomeBack(today, addDays(today, -2), [session(5)])).toBe(true);
  });

  it("is not said before the date, with no date, or after a session on or after it", () => {
    expect(showWelcomeBack(today, addDays(today, 1), [session(5)])).toBe(false);
    expect(showWelcomeBack(today, null, [session(5)])).toBe(false);
    expect(showWelcomeBack(today, addDays(today, -1), [session(0)])).toBe(false);
  });
});

describe("next due", () => {
  it("finds the earliest day after today with reviews and counts them", () => {
    const progress = [
      row("lrn01", { dueAt: today }),
      row("lrn02", { dueAt: addDays(today, 2) }),
      row("lrn03", { dueAt: addDays(today, 2) }),
      row("mat01", { dueAt: addDays(today, 1), parked: true }),
      row("phy01", { dueAt: addDays(today, 5) }),
    ];
    expect(nextDue(progress, today)).toEqual({ day: addDays(today, 2), count: 2 });
  });

  it("is null when nothing is scheduled", () => {
    expect(nextDue([], today)).toBeNull();
  });
});
