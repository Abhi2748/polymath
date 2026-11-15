import { type Grade, isCorrect } from "./grading";
import type { LessonPack, RecallItem } from "./lesson";
import { initialSchedule } from "./scheduler";
import type { ProgressRow } from "./state";

export type FirstCheckAttempt = 1 | 2;
export type FirstCheckOutcome = "passed" | "retry" | "failed";

export type LessonProgress = {
  state: ProgressRow["state"];
  // 0 to steps - 1 is a step from lessonSteps (the cards, plus the excerpt if any); steps means the first check.
  cardIndex: number;
  learnedAt: Date | null;
  box: number | null;
  dueAt: string | null;
};

export function firstCheckItems(pack: LessonPack): RecallItem[] {
  return pack.recall_items.filter((i) => i.first_check);
}

// The second attempt rotates the items by one, so none stays in its place.
export function firstCheckOrder(items: RecallItem[], attempt: FirstCheckAttempt): RecallItem[] {
  return attempt === 1 ? [...items] : [...items.slice(1), ...items.slice(0, 1)];
}

export function firstCheckOutcome(attempt: FirstCheckAttempt, grades: Grade[]): FirstCheckOutcome {
  if (grades.length !== 3) throw new Error(`the first check has three items, got ${grades.length} grades`);
  if (grades.filter(isCorrect).length >= 2) return "passed";
  return attempt === 1 ? "retry" : "failed";
}

export function progressOnOpen(current: LessonProgress | null): LessonProgress {
  if (current && current.state !== "new") return current;
  return { state: "in_progress", cardIndex: 0, learnedAt: null, box: null, dueAt: null };
}

export function progressOnCard(current: LessonProgress, index: number, cardCount: number): LessonProgress {
  if (!Number.isInteger(index) || index < 0 || index > cardCount) {
    throw new Error(`card index ${index} is outside 0..${cardCount}`);
  }
  if (current.state !== "in_progress") return current;
  return { ...current, cardIndex: index };
}

export function progressAfterFirstCheck(
  current: LessonProgress,
  outcome: FirstCheckOutcome,
  { now, today, cardCount }: { now: Date; today: string; cardCount: number },
): LessonProgress {
  switch (outcome) {
    case "passed":
      return { ...current, state: "learned", cardIndex: cardCount, learnedAt: now, ...initialSchedule(today) };
    case "failed":
      return { ...current, state: "in_progress", cardIndex: cardCount };
    case "retry":
      return current;
  }
}
