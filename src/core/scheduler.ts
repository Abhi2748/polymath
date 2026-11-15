import { type Grade, isCorrect } from "./grading";
import type { LessonPack, RecallItem } from "./lesson";
import type { ProgressRow } from "./state";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_START_HOURS = 4;

// Index is the box; index 0 is unused.
export const INTERVALS = [0, 1, 3, 7, 16, 35, 75, 150, 300] as const;
const TOP_BOX = 8;

// The local date of (now minus 4 hours) in the user's time zone, as YYYY-MM-DD.
export function sessionDay(now: Date, tz: string): string {
  const shifted = new Date(now.getTime() - DAY_START_HOURS * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    shifted,
  );
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const ms = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(to) - ms(from)) / DAY_MS);
}

export function initialSchedule(today: string): { box: 1; dueAt: string } {
  return { box: 1, dueAt: addDays(today, 1) };
}

// FNV-1a, so the shift is the same for a topic on every run and every machine.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// The box's interval shifted by a fixed fraction between -10% and +10% for this topic, in whole days.
export function dueInterval(topicId: string, box: number): number {
  const shift = (hash(topicId) / 0xffffffff) * 0.2 - 0.1;
  return Math.max(1, Math.round(INTERVALS[box] * (1 + shift)));
}

export type ReviewProgress = {
  topicId: string;
  state: Extract<ProgressRow["state"], "learned" | "recalled">;
  box: number;
  dueAt: string;
  // Session day of the last review, or null before the first one.
  lastReviewedDay: string | null;
  successStreak: number;
  failStreak: number;
  lapsed: boolean;
};

export function applyReview(progress: ReviewProgress, results: Grade[], today: string): ReviewProgress {
  if (results.length !== 2) throw new Error(`a review has two questions, got ${results.length} grades`);
  const correct = results.filter(isCorrect).length;

  let { box, successStreak, failStreak, lapsed, state } = progress;
  if (correct === 2) {
    const longGap =
      progress.lastReviewedDay !== null && daysBetween(progress.lastReviewedDay, today) >= 2 * INTERVALS[box];
    box = Math.min(TOP_BOX, box + (longGap ? 2 : 1));
    successStreak += 1;
    failStreak = 0;
    lapsed = false;
  } else if (correct === 0) {
    box = 1;
    successStreak = 0;
    failStreak += 1;
    if (failStreak >= 2) lapsed = true;
  }

  if (successStreak >= 3) state = "recalled";
  if (lapsed) state = "learned";

  return {
    ...progress,
    state,
    box,
    dueAt: addDays(today, dueInterval(progress.topicId, box)),
    lastReviewedDay: today,
    successStreak,
    failStreak,
    lapsed,
  };
}

export type HistoryRow = {
  topicId: string;
  itemId: string;
  askedAt: Date;
  context: "first_check" | "review" | "probe";
};

function samePair(a: string[], b: string[]): boolean {
  return a.length === 2 && b.length === 2 && a.includes(b[0]) && a.includes(b[1]);
}

// Two recall items, least recently asked first (never asked comes first of all, ties in pack order),
// and never the same pair as the previous review.
export function pickReviewItems(pack: LessonPack, history: HistoryRow[]): [RecallItem, RecallItem] {
  const own = history.filter((h) => h.topicId === pack.topic_id);

  const lastAsked = new Map<string, number>();
  for (const h of own) {
    lastAsked.set(h.itemId, Math.max(lastAsked.get(h.itemId) ?? -Infinity, h.askedAt.getTime()));
  }
  const ranked = pack.recall_items
    .map((item, order) => ({ item, order, at: lastAsked.get(item.id) ?? -Infinity }))
    .sort((a, b) => a.at - b.at || a.order - b.order)
    .map((r) => r.item);

  const previous = own
    .filter((h) => h.context === "review")
    .sort((a, b) => b.askedAt.getTime() - a.askedAt.getTime())
    .slice(0, 2)
    .map((h) => h.itemId);

  const [first, second, third] = ranked;
  if (samePair([first.id, second.id], previous)) return [first, third];
  return [first, second];
}
