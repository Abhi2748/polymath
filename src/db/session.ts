import { and, eq, gte, isNull, sql } from "drizzle-orm";
import skeletonJson from "../../data/skeleton.json";
import {
  advanceSession,
  buildDeck,
  type Deck,
  type DeckLesson,
  type DeckProgress,
  type DeckSettings,
  type DeckSkeleton,
  type SessionKind,
  type SessionRecord,
  type SessionSummary,
  sessionComplete,
  showWelcomeBack,
  type StepResult,
} from "@/core/deck";
import type { Grade } from "@/core/grading";
import { sessionDay, type ReviewProgress } from "@/core/scheduler";
import { ignorePrereqs } from "@/lib/dev";
import { db } from "./client";
import { itemHistory, lessons, sessions, topicProgress, userSettings } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const skeleton: DeckSkeleton = {
  fields: skeletonJson.fields.map((f) => ({ code: f.code, kind: f.kind })),
  topics: skeletonJson.topics.map((t) => ({ id: t.id, field: t.field, season: t.season, seq: t.seq, prereqs: t.prereqs })),
};

export type SessionRow = SessionRecord & { id: number; startedAt: Date };

async function loadSettings(userId: string): Promise<DeckSettings & { plannedReturn: string | null }> {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  return {
    tz: row?.tz ?? "UTC",
    maxNewPerDay: row?.maxNewPerDay ?? 2,
    fieldsOff: row?.fieldsOff ?? [],
    sessionMinutes: row?.sessionMinutes ?? 30,
    plannedReturn: row?.plannedReturn ?? null,
  };
}

async function loadProgress(userId: string): Promise<(DeckProgress & { lastReviewedAt: Date | null })[]> {
  const rows = await db
    .select({
      topicId: topicProgress.topicId,
      state: topicProgress.state,
      dueAt: topicProgress.dueAt,
      lapsed: topicProgress.lapsed,
      parked: topicProgress.parked,
      lastReviewedAt: topicProgress.lastReviewedAt,
    })
    .from(topicProgress)
    .where(eq(topicProgress.userId, userId));
  return rows.map((r) => {
    if (r.state === "explained" || r.state === "connected") throw new Error(`state ${r.state} is not used in release 1`);
    return { ...r, state: r.state };
  });
}

async function loadSessions(userId: string): Promise<SessionRow[]> {
  const rows = await db.select().from(sessions).where(eq(sessions.userId, userId));
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.startedAt,
    sessionDay: r.sessionDay,
    kind: r.kind as SessionKind,
    completed: r.completedAt !== null,
    summary: r.summary as SessionSummary,
  }));
}

async function loadLessons(): Promise<DeckLesson[]> {
  return db.select({ topicId: lessons.topicId, estMinutes: sql<number>`(${lessons.pack}->>'est_minutes')::int` }).from(lessons);
}

export async function loadToday(userId: string, now: Date, today: (tz: string) => string) {
  const [settings, rows, history, lessonRows] = await Promise.all([
    loadSettings(userId),
    loadProgress(userId),
    loadSessions(userId),
    loadLessons(),
  ]);
  const progress = rows.map(({ lastReviewedAt, ...row }) => ({
    ...row,
    lastReviewedDay: lastReviewedAt ? sessionDay(lastReviewedAt, settings.tz) : null,
  }));
  const day = today(settings.tz);
  const todays = history.filter((r) => r.sessionDay === day);
  const deck = (kind: SessionKind): Deck =>
    buildDeck(now, settings, progress, history, skeleton, lessonRows, { kind, ignorePrereqs: ignorePrereqs() });
  return {
    day,
    tz: settings.tz,
    progress,
    welcomeBack: showWelcomeBack(day, settings.plannedReturn, history),
    completed: todays.find((r) => r.completed) ?? null,
    active: todays.find((r) => !r.completed) ?? null,
    deck,
  };
}

export async function insertSession(userId: string, deck: Deck, startedAt: Date) {
  const summary: SessionSummary = { steps: deck.steps, done: 0, reviews: [], lessons: [], probes: [] };
  await db
    .insert(sessions)
    .values({ userId, sessionDay: deck.sessionDay, kind: deck.kind, mode: deck.mode, startedAt, summary })
    .onConflictDoNothing();
}

// Moves today's open session past its current step if the result is for that step.
export async function advanceOpenSession(tx: Tx, userId: string, today: string, result: StepResult, now: Date) {
  const [row] = await tx
    .select({ id: sessions.id, summary: sessions.summary })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.sessionDay, today), isNull(sessions.completedAt)))
    .for("update");
  if (!row) return;
  const next = advanceSession(row.summary as SessionSummary, result);
  if (!next) return;
  await tx
    .update(sessions)
    .set({ summary: next, completedAt: sessionComplete(next) ? now : null })
    .where(eq(sessions.id, row.id));
}

export async function getReviewProgress(userId: string, topicId: string) {
  const [row] = await db
    .select()
    .from(topicProgress)
    .where(and(eq(topicProgress.userId, userId), eq(topicProgress.topicId, topicId)));
  return row ?? null;
}

export async function getTopicHistory(userId: string, topicId: string) {
  return db
    .select({ topicId: itemHistory.topicId, itemId: itemHistory.itemId, askedAt: itemHistory.askedAt, context: itemHistory.context })
    .from(itemHistory)
    .where(and(eq(itemHistory.userId, userId), eq(itemHistory.topicId, topicId)))
    .then((rows) => rows.map((r) => ({ ...r, context: r.context as "first_check" | "review" | "probe" })));
}

export async function scheduledReviewCounts(userId: string, exceptTopicId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({
      topicId: topicProgress.topicId,
      dueAt: topicProgress.dueAt,
      state: topicProgress.state,
      parked: topicProgress.parked,
    })
    .from(topicProgress)
    .where(eq(topicProgress.userId, userId));
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.topicId === exceptTopicId || row.parked || row.dueAt === null) continue;
    if (row.state !== "learned" && row.state !== "recalled") continue;
    counts.set(row.dueAt, (counts.get(row.dueAt) ?? 0) + 1);
  }
  return counts;
}

export async function recordProbe(
  userId: string,
  today: string,
  askedAt: Date,
  grade: { itemId: string; grade: Grade },
  next: ReviewProgress,
  passed: boolean,
) {
  await db.transaction(async (tx) => {
    await tx.insert(itemHistory).values({
      userId,
      topicId: next.topicId,
      itemId: grade.itemId,
      askedAt,
      grade: grade.grade,
      context: "probe",
    });
    await tx
      .update(topicProgress)
      .set({
        state: next.state,
        box: next.box,
        dueAt: next.dueAt,
        lastReviewedAt: askedAt,
        successStreak: next.successStreak,
        failStreak: next.failStreak,
        lapsed: next.lapsed,
      })
      .where(and(eq(topicProgress.userId, userId), eq(topicProgress.topicId, next.topicId)));
    await advanceOpenSession(tx, userId, today, { kind: "probe", topicId: next.topicId, passed }, askedAt);
  });
}

export async function recordReview(
  userId: string,
  today: string,
  askedAt: Date,
  grades: { itemId: string; grade: Grade }[],
  next: ReviewProgress,
  correct: number,
) {
  await db.transaction(async (tx) => {
    await tx
      .insert(itemHistory)
      .values(grades.map((g) => ({ userId, topicId: next.topicId, itemId: g.itemId, askedAt, grade: g.grade, context: "review" })));
    await tx
      .update(topicProgress)
      .set({
        state: next.state,
        box: next.box,
        dueAt: next.dueAt,
        lastReviewedAt: askedAt,
        successStreak: next.successStreak,
        failStreak: next.failStreak,
        lapsed: next.lapsed,
      })
      .where(and(eq(topicProgress.userId, userId), eq(topicProgress.topicId, next.topicId)));
    await advanceOpenSession(tx, userId, today, { kind: "review", topicId: next.topicId, correct }, askedAt);
  });
}

export async function advanceLessonStep(
  userId: string,
  today: string,
  topicId: string,
  outcome: "passed" | "failed",
  now: Date,
) {
  await db.transaction((tx) => advanceOpenSession(tx, userId, today, { kind: "lesson", topicId, outcome }, now));
}

export async function countFirstCheckAnswers(userId: string, topicId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(itemHistory)
    .where(
      and(
        eq(itemHistory.userId, userId),
        eq(itemHistory.topicId, topicId),
        eq(itemHistory.context, "first_check"),
        gte(itemHistory.askedAt, since),
      ),
    );
  return row.n;
}
