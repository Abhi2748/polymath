import { daysBetween, sessionDay } from "./scheduler";
import { prereqsMet, type ProgressRow } from "./state";

export type Mode = "normal" | "catch_up" | "return_check";
export type SessionKind = "full" | "short";

export type DeckStep =
  | { kind: "review"; topicId: string }
  | { kind: "probe"; topicId: string }
  | { kind: "lesson"; topicId: string; isNew: boolean; refresher?: boolean }
  | { kind: "end" };

// Stored in sessions.summary: the deck planned at Start, how far the learner got, and the results.
export type SessionSummary = {
  steps: DeckStep[];
  done: number;
  reviews: { topicId: string; correct: number }[];
  lessons: { topicId: string; outcome: "passed" | "failed" }[];
  probes?: { topicId: string; passed: boolean }[];
};

export type SessionRecord = {
  sessionDay: string;
  kind: SessionKind;
  completed: boolean;
  summary: SessionSummary;
};

export type DeckSettings = { tz: string; maxNewPerDay: number; fieldsOff: string[]; sessionMinutes: number };

export type DeckProgress = ProgressRow & {
  dueAt: string | null;
  parked: boolean;
  // Session day of the last review, when there has been one. Probe order uses it.
  lastReviewedDay?: string | null;
};

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
const PROBE_SECONDS = 20;
const NORMAL_REVIEW_SECONDS = 10 * 60;
const SHORT_REVIEW_SECONDS = 15 * 60;
const PROBE_BUDGET_SECONDS = 15 * 60;
const TEN_MINUTES = 10 * 60;
const OVERLOAD_SECONDS = 15 * 60;
const GUARD_SESSIONS = 7;
const GUARD_MIN_REVIEWS = 10;
const GUARD_MIN_RATE = 0.7;
const MAX_NEW_PER_SESSION_DAY = 3;
const MAX_IN_PROGRESS = 2;
const CONSOLIDATION_SESSIONS = 7;
const RETURN_AFTER_DAYS = 15;
const LONG_ABSENCE_DAYS = 60;
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

  const away = daysAway(today, history);
  const probePool = progress.filter((p) => isLearned(p) && !p.parked && inDeck(p.topicId));
  const episode = returnEpisode(today, history, new Set(probePool.map((p) => p.topicId)));
  const mode: Mode = episode.active ? "return_check" : away >= 4 ? "catch_up" : "normal";

  // Reviews due today. The return check reschedules these as probes pass; until then they gate new lessons.
  const due = progress
    .filter((p) => isLearned(p) && p.dueAt !== null && p.dueAt <= today && !p.parked && inDeck(p.topicId))
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!) || a.topicId.localeCompare(b.topicId));

  const inProgress =
    kind === "full"
      ? progress
          .filter((p) => p.state === "in_progress" && inDeck(p.topicId))
          .sort((a, b) => order.get(a.topicId)! - order.get(b.topicId)!)
      : [];

  const earlierToday = history.filter((r) => r.sessionDay === today).flatMap(newLessonIds);
  const limit = Math.min(settings.maxNewPerDay, MAX_NEW_PER_SESSION_DAY - earlierToday.length);
  const picks =
    kind === "full"
      ? chooseNewLessons({
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
        })
      : [];

  const dueFits = due.length * REVIEW_SECONDS <= TEN_MINUTES;
  const consolidating = seasonConsolidating(skeleton, history, inDeck, progressOf);
  const prereqsPassed = probePrereqsPassed(picks, byId, progressOf, estMinutes, fieldOn, episode.probed);
  let allowNew = false;
  if (kind === "full" && inProgress.length < MAX_IN_PROGRESS && !consolidating) {
    if (mode === "normal") allowNew = due.length * REVIEW_SECONDS <= OVERLOAD_SECONDS && reviewRateOk(history);
    else if (mode === "catch_up") allowNew = dueFits;
    else allowNew = dueFits && prereqsPassed;
  }

  const steps: DeckStep[] = [];
  if (mode === "return_check" && kind === "full") {
    const cap = sessionCapSeconds(episode, settings.sessionMinutes);
    const probeBudget = Math.min(PROBE_BUDGET_SECONDS, cap);
    const queued = orderProbes(
      probePool.filter((p) => !episode.probed.has(p.topicId)),
      picks,
      byId,
    ).slice(0, Math.floor(probeBudget / PROBE_SECONDS));
    steps.push(...queued.map((p): DeckStep => ({ kind: "probe", topicId: p.topicId })));
    let used = queued.length * PROBE_SECONDS;
    const resumed = fitLessons(
      inProgress.map((p) => p.topicId),
      false,
      used,
      cap,
      estMinutes,
    );
    steps.push(...resumed.steps);
    used = resumed.used;
    if (allowNew) steps.push(...fitLessons(picks, true, used, cap, estMinutes).steps);
  } else {
    const budget = kind === "short" ? SHORT_REVIEW_SECONDS : mode === "catch_up" ? settings.sessionMinutes * 30 : NORMAL_REVIEW_SECONDS;
    const reviews = due.slice(0, Math.floor(budget / REVIEW_SECONDS));
    const refreshers = kind === "full" ? topicsNeedingRefresher(history) : new Set<string>();
    for (const p of reviews) {
      if (refreshers.has(p.topicId)) steps.push({ kind: "lesson", topicId: p.topicId, isNew: false, refresher: true });
      steps.push({ kind: "review", topicId: p.topicId });
    }
    if (kind === "full") {
      steps.push(...inProgress.map((p): DeckStep => ({ kind: "lesson", topicId: p.topicId, isNew: false })));
      if (allowNew) steps.push(...picks.map((id): DeckStep => ({ kind: "lesson", topicId: id, isNew: true })));
    }
  }

  const seconds = steps.reduce((sum, s) => {
    if (s.kind === "review") return sum + REVIEW_SECONDS;
    if (s.kind === "probe") return sum + PROBE_SECONDS;
    if (s.kind === "lesson") return sum + estMinutes.get(s.topicId)! * 60;
    return sum;
  }, 0);
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

function daysAway(today: string, history: SessionRecord[]): number {
  const days = history.filter((r) => r.completed).map((r) => r.sessionDay);
  if (days.length === 0) return 0;
  const last = days.reduce((a, b) => (a > b ? a : b));
  return Math.max(0, daysBetween(last, today));
}

type Episode = {
  active: boolean;
  // Present once the topic has been probed in this return. The value is whether it passed.
  probed: Map<string, boolean>;
  daysAwayAtStart: number;
  fullSessionsBeforeToday: number;
};

// A return check starts on a gap of 15 days or more and stays until every learned topic has been probed.
function returnEpisode(today: string, history: SessionRecord[], probeTopics: Set<string>): Episode {
  const none: Episode = { active: false, probed: new Map(), daysAwayAtStart: 0, fullSessionsBeforeToday: 0 };
  const completed = [...new Set(history.filter((r) => r.completed).map((r) => r.sessionDay))].sort();
  const days = completed.includes(today) ? completed : [...completed, today].sort();
  let start: string | null = null;
  let gapAtStart = 0;
  let prev: string | null = null;
  for (const day of days) {
    const gap = prev === null ? 0 : daysBetween(prev, day);
    if (gap >= RETURN_AFTER_DAYS) {
      start = day;
      gapAtStart = gap;
    }
    prev = day;
  }
  if (start === null) return none;

  const latest = new Map<string, { day: string; passed: boolean }>();
  for (const record of history) {
    if (record.sessionDay < start) continue;
    for (const probe of record.summary.probes ?? []) {
      const previous = latest.get(probe.topicId);
      if (!previous || record.sessionDay >= previous.day) latest.set(probe.topicId, { day: record.sessionDay, passed: probe.passed });
    }
  }
  const probed = new Map([...latest].map(([id, value]) => [id, value.passed]));
  const allProbed = [...probeTopics].every((id) => probed.has(id));
  const fullSessionsBeforeToday = history.filter(
    (r) => r.kind === "full" && r.completed && r.sessionDay >= start && r.sessionDay < today,
  ).length;
  return { active: start === today || !allProbed, probed, daysAwayAtStart: gapAtStart, fullSessionsBeforeToday };
}

// No total cap unless the absence that started this return was 60 days or more.
function sessionCapSeconds(episode: Episode, setting: number): number {
  if (episode.daysAwayAtStart < LONG_ABSENCE_DAYS) return Number.POSITIVE_INFINITY;
  const minutes = episode.fullSessionsBeforeToday < 2 ? 20 : episode.fullSessionsBeforeToday < 4 ? 40 : setting;
  return minutes * 60;
}

function orderProbes(queue: DeckProgress[], nextIds: string[], byId: Map<string, Topic>): DeckProgress[] {
  const wanted: string[] = [];
  const seen = new Set<string>();
  for (const id of nextIds) {
    for (const pre of byId.get(id)?.prereqs ?? []) {
      if (seen.has(pre)) continue;
      seen.add(pre);
      wanted.push(pre);
    }
  }
  const byTopic = new Map(queue.map((p) => [p.topicId, p]));
  const first = wanted.filter((id) => byTopic.has(id));
  const firstSet = new Set(first);
  const rest = queue
    .filter((p) => !firstSet.has(p.topicId))
    .sort((a, b) => (a.lastReviewedDay ?? "").localeCompare(b.lastReviewedDay ?? "") || a.topicId.localeCompare(b.topicId));
  return [...first.map((id) => byTopic.get(id)!), ...rest];
}

function probePrereqsPassed(
  picks: string[],
  byId: Map<string, Topic>,
  progressOf: Map<string, DeckProgress>,
  estMinutes: Map<string, number>,
  fieldOn: (code: string) => boolean,
  probed: Map<string, boolean>,
): boolean {
  const ids = new Set(picks.flatMap((id) => byId.get(id)?.prereqs ?? []));
  for (const id of ids) {
    const topic = byId.get(id);
    if (!topic || !fieldOn(topic.field) || !estMinutes.has(id)) continue;
    const row = progressOf.get(id);
    if (!row || !isLearned(row) || row.parked) continue;
    if (probed.get(id) !== true) return false;
  }
  return true;
}

function fitLessons(
  ids: string[],
  isNew: boolean,
  used: number,
  cap: number,
  estMinutes: Map<string, number>,
): { steps: DeckStep[]; used: number } {
  const steps: DeckStep[] = [];
  for (const id of ids) {
    const cost = estMinutes.get(id)! * 60;
    if (used + cost > cap) break;
    steps.push({ kind: "lesson", topicId: id, isNew });
    used += cost;
  }
  return { steps, used };
}

// The next 7 full sessions after a season is finished offer nothing new. A refresher does not move that day.
function seasonConsolidating(
  skeleton: DeckSkeleton,
  history: SessionRecord[],
  inDeck: (id: string) => boolean,
  progressOf: Map<string, DeckProgress>,
): boolean {
  const topics = skeleton.topics.filter((t) => inDeck(t.id));
  const seasons = [...new Set(topics.map((t) => t.season))].sort((a, b) => a - b);
  const open = seasons.find((s) => topics.some((t) => t.season === s && !isLearned(progressOf.get(t.id))));
  if (open === undefined) return false;
  const previous = [...seasons].reverse().find((s) => s < open);
  if (previous === undefined) return false;
  const ids = new Set(topics.filter((t) => t.season === previous).map((t) => t.id));
  const passDays: string[] = [];
  for (const record of history) {
    const refreshers = new Set(record.summary.steps.flatMap((s) => (s.kind === "lesson" && s.refresher ? [s.topicId] : [])));
    for (const lesson of record.summary.lessons) {
      if (lesson.outcome === "passed" && ids.has(lesson.topicId) && !refreshers.has(lesson.topicId)) passDays.push(record.sessionDay);
    }
  }
  if (passDays.length === 0) return true;
  const last = passDays.reduce((a, b) => (a > b ? a : b));
  const since = history.filter((r) => r.kind === "full" && r.completed && r.sessionDay > last).length;
  return since < CONSOLIDATION_SESSIONS;
}

function topicsNeedingRefresher(history: SessionRecord[]): Set<string> {
  const lastProbe = new Map<string, { day: string; passed: boolean }>();
  const lastReview = new Map<string, string>();
  for (const record of history) {
    for (const probe of record.summary.probes ?? []) {
      const previous = lastProbe.get(probe.topicId);
      if (!previous || record.sessionDay >= previous.day) lastProbe.set(probe.topicId, { day: record.sessionDay, passed: probe.passed });
    }
    for (const review of record.summary.reviews) {
      const previous = lastReview.get(review.topicId);
      if (!previous || record.sessionDay > previous) lastReview.set(review.topicId, record.sessionDay);
    }
  }
  const need = new Set<string>();
  for (const [id, probe] of lastProbe) {
    if (probe.passed) continue;
    const reviewed = lastReview.get(id);
    if (!reviewed || reviewed < probe.day) need.add(id);
  }
  return need;
}

// The planned date is a greeting only. It does not change the deck.
export function showWelcomeBack(today: string, plannedReturn: string | null, history: SessionRecord[]): boolean {
  if (!plannedReturn || today < plannedReturn) return false;
  const days = history.filter((r) => r.completed).map((r) => r.sessionDay);
  if (days.length === 0) return true;
  const last = days.reduce((a, b) => (a > b ? a : b));
  return last < plannedReturn;
}

export type StepResult =
  | { kind: "review"; topicId: string; correct: number }
  | { kind: "probe"; topicId: string; passed: boolean }
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
    probes:
      result.kind === "probe"
        ? [...(summary.probes ?? []), { topicId: result.topicId, passed: result.passed }]
        : summary.probes,
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
