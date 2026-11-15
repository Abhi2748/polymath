import type { Card, LessonPack } from "./lesson";

export type LessonStep = { kind: "card"; card: Card } | { kind: "excerpt" };

// What the lesson player shows before the first check, in order. card_index counts these steps.
export function lessonSteps(pack: LessonPack): LessonStep[] {
  const steps: LessonStep[] = pack.cards.map((card) => ({ kind: "card", card }));
  if (pack.excerpt) {
    const guessAt = pack.cards.findIndex((c) => c.kind === "guess");
    steps.splice(guessAt + 1, 0, { kind: "excerpt" });
  }
  return steps;
}
