import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  firstCheckItems,
  firstCheckOrder,
  firstCheckOutcome,
  type LessonProgress,
  progressAfterFirstCheck,
  progressOnCard,
  progressOnOpen,
} from "./firstCheck";
import { type LessonPack, lessonPackSchema } from "./lesson";

const pack: LessonPack = lessonPackSchema.parse(
  JSON.parse(readFileSync(join(process.cwd(), "data", "lessons", "lrn01.json"), "utf8")),
);
const cardCount = pack.cards.length;
const now = new Date("2026-03-10T15:00:00Z");
const today = "2026-03-10";

const inProgress: LessonProgress = { state: "in_progress", cardIndex: cardCount, learnedAt: null, box: null, dueAt: null };

describe("first check items", () => {
  it("asks the three first_check items in pack order", () => {
    expect(firstCheckItems(pack).map((i) => i.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("asks the same items in a different order on the second attempt", () => {
    const items = firstCheckItems(pack);
    const first = firstCheckOrder(items, 1).map((i) => i.id);
    const second = firstCheckOrder(items, 2).map((i) => i.id);
    expect([...second].sort()).toEqual([...first].sort());
    second.forEach((id, i) => expect(id).not.toBe(first[i]));
  });
});

describe("first check outcome", () => {
  it("passes with two of three correct", () => {
    expect(firstCheckOutcome(1, ["correct", "got_it", "wrong"])).toBe("passed");
  });

  it("passes with three of three correct", () => {
    expect(firstCheckOutcome(1, ["correct", "correct", "got_it"])).toBe("passed");
  });

  it("does not count Partly as correct", () => {
    expect(firstCheckOutcome(1, ["correct", "partly", "forgot"])).toBe("retry");
  });

  it("asks again after a first fail", () => {
    expect(firstCheckOutcome(1, ["wrong", "wrong", "correct"])).toBe("retry");
  });

  it("passes on the second attempt with two of three correct", () => {
    expect(firstCheckOutcome(2, ["wrong", "correct", "got_it"])).toBe("passed");
  });

  it("fails after a second fail", () => {
    expect(firstCheckOutcome(2, ["wrong", "partly", "correct"])).toBe("failed");
  });

  it("refuses anything but three grades", () => {
    expect(() => firstCheckOutcome(1, ["correct", "correct"])).toThrow();
  });
});

describe("progress after the first check", () => {
  it("a pass makes the topic learned with its first review in box 1 one day later", () => {
    expect(progressAfterFirstCheck(inProgress, "passed", { now, today, cardCount })).toEqual({
      state: "learned",
      cardIndex: cardCount,
      learnedAt: now,
      box: 1,
      dueAt: "2026-03-11",
    });
  });

  it("a second fail leaves the lesson in progress, reopening at the first check", () => {
    const midway = { ...inProgress, cardIndex: 3 };
    expect(progressAfterFirstCheck(midway, "failed", { now, today, cardCount })).toEqual({
      ...inProgress,
      state: "in_progress",
      cardIndex: cardCount,
    });
  });

  it("a first fail changes nothing yet", () => {
    expect(progressAfterFirstCheck(inProgress, "retry", { now, today, cardCount })).toEqual(inProgress);
  });
});

describe("progress while reading", () => {
  it("opening a new lesson puts it in progress at the first card", () => {
    expect(progressOnOpen(null)).toEqual({ state: "in_progress", cardIndex: 0, learnedAt: null, box: null, dueAt: null });
    expect(progressOnOpen({ ...inProgress, state: "new", cardIndex: 0 }).state).toBe("in_progress");
  });

  it("reopening a lesson in progress keeps its card", () => {
    const midway = { ...inProgress, cardIndex: 4 };
    expect(progressOnOpen(midway)).toEqual(midway);
  });

  it("opening a learned lesson does not move it back to in progress", () => {
    const learned: LessonProgress = { state: "learned", cardIndex: cardCount, learnedAt: now, box: 1, dueAt: "2026-03-11" };
    expect(progressOnOpen(learned)).toEqual(learned);
  });

  it("moving to a card saves its index", () => {
    expect(progressOnCard({ ...inProgress, cardIndex: 0 }, 5, cardCount).cardIndex).toBe(5);
  });

  it("the index after the last card means the first check", () => {
    expect(progressOnCard({ ...inProgress, cardIndex: 0 }, cardCount, cardCount).cardIndex).toBe(cardCount);
  });

  it("refuses an index outside the lesson", () => {
    expect(() => progressOnCard(inProgress, cardCount + 1, cardCount)).toThrow();
    expect(() => progressOnCard(inProgress, -1, cardCount)).toThrow();
    expect(() => progressOnCard(inProgress, 1.5, cardCount)).toThrow();
  });

  it("does not move the card of a lesson that is not in progress", () => {
    const learned: LessonProgress = { state: "learned", cardIndex: cardCount, learnedAt: now, box: 1, dueAt: "2026-03-11" };
    expect(progressOnCard(learned, 2, cardCount)).toEqual(learned);
  });
});
