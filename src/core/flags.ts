import type { LessonPack } from "./lesson";
import { lessonSteps } from "./lessonSteps";

// The excerpt card has no id of its own in the pack.
export const EXCERPT_REF = "excerpt";
export const FLAG_NOTE_MAX = 1000;

export function isFlagRef(pack: LessonPack, ref: string): boolean {
  if (ref === EXCERPT_REF) return !!pack.excerpt;
  return pack.cards.some((c) => c.id === ref) || pack.recall_items.some((r) => r.id === ref);
}

// Cards are numbered as the lesson player numbers them, counting the excerpt card.
export function describeFlagRef(pack: LessonPack | null, ref: string): string {
  if (!pack) return ref;
  const steps = lessonSteps(pack);
  const at = steps.findIndex((s) => (s.kind === "excerpt" ? ref === EXCERPT_REF : s.card.id === ref));
  if (at >= 0) {
    const step = steps[at];
    return `Card ${at + 1} · ${step.kind === "excerpt" ? pack.excerpt!.work : step.card.title}`;
  }
  const item = pack.recall_items.find((r) => r.id === ref);
  return item ? `Question · ${item.prompt}` : ref;
}

export function flagNote(raw: string): string | null {
  const note = raw.trim();
  return note.length > 0 && note.length <= FLAG_NOTE_MAX ? note : null;
}
