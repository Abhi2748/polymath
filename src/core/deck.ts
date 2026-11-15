import { sessionDay } from "./scheduler";
import { prereqsMet, type ProgressRow } from "./state";

export type Mode = "normal";
export type SessionKind = "full" | "short";

export type DeckStep =
  | { kind: "review"; topicId: string }
  | { kind: "lesson"; topicId: string; isNew: boolean }
  | { kind: "end" };

// Stored in sessions.summary: the deck planned at Start, how far the learner got, and the results.
export type SessionSummary = {
  steps: DeckStep[];
  done: number;
  reviews: { topicId: string; correct: number }[];
  lessons: { topicId: string; outcome: "passed" | "failed" }[];
};

export type SessionRecord = {
  sessionDay: string;
  kind: SessionKind;
  completed: boolean;
  summary: SessionSummary;
};

export type DeckSettings = { tz: string; maxNewPerDay: number; fieldsOff: string[] };

export type DeckProgress = ProgressRow & { dueAt: string | null; parked: boolean };

export type DeckSkeleton = {
  // In skeleton order, which breaks ties between fields.
  fields: { code: string; kind: string }[];
  topics: { id: string; field: string; season: number; seq: number; prereqs: string[] }[];
};

export type DeckLesson = { topicId: string; estMinutes: number };

export type DeckOptions = {
  kind?: SessionKind;
  // Development only: treat every prerequisite as met.
  ignorePrereqs?: boolean;
};

export type Deck = { sessionDay: string; kind: SessionKind; mode: Mode; steps: DeckStep[]; minutes: number };

export const REVIEW_SECONDS = 40;
const REVIEW_BUDGET_SECONDS: Record<SessionKind, number> = { full: 10 * 60, short: 15 * 60 };
const OVERLOAD_SECONDS = 15 * 60;
const GUARD_SESSIONS = 7;
const GUARD_MIN_REVIEWS = 10;
const GUARD_MIN_RATE = 0.7;
const MAX_NEW_PER_SESSION_DAY = 3;
const MAX_IN_PROGRESS = 2;
// Full sessions between spine lessons, in the order they are offered.
const SPINE_CADENCE: [code: string, sessions: number][] = [
  ["THK", 7],
  ["HIS", 10],
];

type Topic = DeckSkeleton["topics"][number];

const isLearned = (p: DeckProgress | undefined) => p?.state === "learned" || p?.state === "recalled";

function newLessonIds(record: SessionRecord): string[] {
  return record.summary.steps.flatMap((s) => (s.kind === "lesson" && s.isNew ? [s.topicId] : []));
}

export function buildDeck(
  now: Date,
  settings: DeckSettings,
  progress: DeckProgress[],
  history: SessionRecord[],
  skeleton: DeckSkeleton,
  lessons: DeckLesson[],
  options: DeckOptions = {},
): Deck {
  const kind = options.kind ?? "full";
  const today = sessionDay(now, settings.tz);
  const mode: Mode = "normal";

  const estMinutes = new Map(lessons.map((l) => [l.topicId, l.estMinutes]));
  const byId = new Map(skeleton.topics.map((t) => [t.id, t]));
  const order = new Map(skeleton.topics.map((t, i) => [t.id, i]));
  const progressOf = new Map(progress.map((p) => [p.topicId, p]));
  const fieldOn = (code: string) => !settings.fieldsOff.includes(code);
  // A topic the deck may use at all: its field is switched on and it has a lesson pack.
  const inDeck = (id: string) => {
    const t = byId.get(id);
    return !!t && fieldOn(t.field) && estMinutes.has(id);
  };

  // Reviews.
  const due = progress
    .filter((p) => isLearned(p) && p.dueAt !== null && p.dueAt <= today && !p.parked && inDeck(p.topicId))
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!) || a.topicId.localeCompare(b.topicId));
  const reviews = due.slice(0, Math.floor(REVIEW_BUDGET_SECONDS[kind] / REVIEW_SECONDS));

  const steps: DeckStep[] = reviews.map((p) => ({ kind: "review", topicId: p.topicId }));

  if (kind === "full") {
    // Lessons in progress.
    const inProgress = progress
      .filter((p) => p.state === "in_progress" && inDeck(p.topicId))
      .sort((a, b) => order.get(a.topicId)! - order.get(b.topicId)!);
    steps.push(...inProgress.map((p): DeckStep => ({ kind: "lesson", topicId: p.topicId, isNew: false })));

    // New lessons.
    const guardOk = due.length * REVIEW_SECONDS <= OVERLOAD_SECONDS && reviewRateOk(history);
    if (guardOk && inProgress.length < MAX_IN_PROGRESS) {
      const earlierToday = history.filter((r) => r.sessionDay === today).flatMap(newLessonIds);
      const limit = Math.min(settings.maxNewPerDay, MAX_NEW_PER_SESSION_DAY - earlierToday.length);
      const picks = chooseNewLessons({
        limit,
        skeleton,
        history,
        earlierToday,
        isUnlearned: (t) => inDeck(t.id) && !isLearned(progressOf.get(t.id)),
        isCandidate: (t) =>
          inDeck(t.id) &&
          (progressOf.get(t.id)?.state ?? "new") === "new" &&
          (options.ignorePrereqs ||
            prereqsMet(
              t.prereqs.filter((id) => byId.has(id)).map((id) => ({ id, fieldCode: byId.get(id)!.field })),
              progress,
              settings.fieldsOff,
            )),
      });
      steps.push(...picks.map((id): DeckStep => ({ kind: "lesson", topicId: id, isNew: true })));
    }
  }

  const seconds = steps.reduce(
    (sum, s) => sum + (s.kind === "review" ? REVIEW_SECONDS : s.kind === "lesson" ? estMinutes.get(s.topicId)! * 60 : 0),
    0,
  );
  steps.push({ kind: "end" });

  return { sessionDay: today, kind, mode, steps, minutes: Math.ceil(seconds / 60) };
}

// The overload guard's second half: the share of reviews with both questions right over the last 7 sessions.
function reviewRateOk(history: SessionRecord[]): boolean {
  const recent = history
    .filter((r) => r.completed)
    .sort((a, b) => b.sessionDay.localeCompare(a.sessionDay))
    .slice(0, GUARD_SESSIONS)
    .flatMap((r) => r.summary.reviews);
  if (recent.length < GUARD_MIN_REVIEWS) return true;
  return recent.filter((r) => r.correct === 2).length / recent.length >= GUARD_MIN_RATE;
}

function chooseNewLessons({
  limit,
  skeleton,
  history,
  earlierToday,
  isUnlearned,
  isCandidate,
}: {
  limit: number;
  skeleton: DeckSkeleton;
  history: SessionRecord[];
  earlierToday: string[];
  isUnlearned: (t: Topic) => boolean;
  isCandidate: (t: Topic) => boolean;
}): string[] {
  if (limit <= 0) return [];
  const fieldOf = new Map(skeleton.topics.map((t) => [t.id, t.field]));
  const kindOf = new Map(skeleton.fields.map((f) => [f.code, f.kind]));
  const bySeq = (a: Topic, b: Topic) => a.seq - b.seq;

  // Starter first: every new lesson comes from it, in sequence, until it is finished.
  const starter = skeleton.topics.filter((t) => kindOf.get(t.field) === "starter");
  if (starter.some(isUnlearned)) {
    return starter.filter(isCandidate).sort(bySeq).slice(0, limit).map((t) => t.id);
  }

  // Current season: the lowest one with unlearned topics. If none of them is unlocked, nothing new today.
  const unlearned = skeleton.topics.filter(isUnlearned);
  if (unlearned.length === 0) return [];
  const season = Math.min(...unlearned.map((t) => t.season));
  const candidates = skeleton.topics.filter((t) => t.season === season && isCandidate(t)).sort(bySeq);
  const firstIn = (field: string) => candidates.find((t) => t.field === field && !picks.includes(t.id));

  const picks: string[] = [];
  const usedToday = new Set(earlierToday.map((id) => fieldOf.get(id)));

  for (const [code, cadence] of SPINE_CADENCE) {
    if (picks.length >= limit) break;
    const topic = firstIn(code);
    if (topic && fullSessionsSinceLesson(history, code, fieldOf) >= cadence) {
      picks.push(topic.id);
      usedToday.add(code);
    }
  }

  // Rotation: the other fields, least recently studied first, each at most once a day.
  const lastStudied = new Map<string, string>();
  for (const record of history) {
    for (const id of newLessonIds(record)) {
      const field = fieldOf.get(id)!;
      if ((lastStudied.get(field) ?? "") < record.sessionDay) lastStudied.set(field, record.sessionDay);
    }
  }
  const rotation = skeleton.fields
    .filter((f) => f.kind === "field")
    .map((f, i) => ({ code: f.code, last: lastStudied.get(f.code) ?? "", i }))
    .sort((a, b) => a.last.localeCompare(b.last) || a.i - b.i);
  for (const { code } of rotation) {
    if (picks.length >= limit) break;
    if (usedToday.has(code)) continue;
    const topic = firstIn(code);
    if (topic) {
      picks.push(topic.id);
      usedToday.add(code);
    }
  }

  return picks;
}

// Completed full sessions after the session that last offered a new lesson from this field.
// Infinity if none ever has, so the first one is due at once.
function fullSessionsSinceLesson(history: SessionRecord[], field: string, fieldOf: Map<string, string>): number {
  const days = history.filter((r) => newLessonIds(r).some((id) => fieldOf.get(id) === field)).map((r) => r.sessionDay);
  if (days.length === 0) return Infinity;
  const last = days.reduce((a, b) => (a > b ? a : b));
  return history.filter((r) => r.kind === "full" && r.completed && r.sessionDay > last).length;
}

export type StepResult =
  | { kind: "review"; topicId: string; correct: number }
  | { kind: "lesson"; topicId: string; outcome: "passed" | "failed" };

export function currentStep(summary: SessionSummary): DeckStep {
  return summary.steps[Math.min(summary.done, summary.steps.length - 1)];
}

// The summary after finishing the current step, or null when the result is not for the current step.
export function advanceSession(summary: SessionSummary, result: StepResult): SessionSummary | null {
  const step = currentStep(summary);
  if (step.kind === "end" || step.kind !== result.kind || step.topicId !== result.topicId) return null;
  return {
    ...summary,
    done: summary.done + 1,
    reviews: result.kind === "review" ? [...summary.reviews, { topicId: result.topicId, correct: result.correct }] : summary.reviews,
    lessons: result.kind === "lesson" ? [...summary.lessons, { topicId: result.topicId, outcome: result.outcome }] : summary.lessons,
  };
}

export function sessionComplete(summary: SessionSummary): boolean {
  return currentStep(summary).kind === "end";
}

// The first day after today with reviews due, and how many.
export function nextDue(progress: DeckProgress[], today: string): { day: string; count: number } | null {
  const days = progress
    .filter((p) => isLearned(p) && !p.parked && p.dueAt !== null && p.dueAt > today)
    .map((p) => p.dueAt!);
  if (days.length === 0) return null;
  const day = days.reduce((a, b) => (a < b ? a : b));
  return { day, count: days.filter((d) => d === day).length };
}
