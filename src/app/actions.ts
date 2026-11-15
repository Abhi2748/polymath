"use server";

import { revalidatePath } from "next/cache";
import { currentStep, type SessionKind } from "@/core/deck";
import { progressOnOpen } from "@/core/firstCheck";
import { gradeResponse, isCorrect, type Response } from "@/core/grading";
import { applyProbe, applyReview, pickReviewItems, probeItem, sessionDay } from "@/core/scheduler";
import { getLessonPack, getLessonProgress, saveLessonProgress } from "@/db/lessonProgress";
import {
  advanceLessonStep,
  countFirstCheckAnswers,
  getReviewProgress,
  getTopicHistory,
  insertSession,
  loadToday,
  recordProbe,
  recordReview,
  scheduledReviewCounts,
} from "@/db/session";
import { requireUserId } from "@/lib/auth";
import { appNow } from "@/lib/dev";

const FIRST_CHECK_ITEMS = 3;

async function today(userId: string) {
  const now = appNow();
  return { now, ...(await loadToday(userId, now, (tz) => sessionDay(now, tz))) };
}

async function requireCurrentStep(userId: string, kind: "review" | "probe" | "lesson", topicId: string) {
  const t = await today(userId);
  const step = t.active ? currentStep(t.active.summary) : null;
  if (!step || step.kind === "end" || step.kind !== kind || step.topicId !== topicId) {
    throw new Error(`${topicId} is not the current ${kind} step`);
  }
  return t;
}

export async function startSession(kind: SessionKind) {
  const userId = await requireUserId();
  const t = await today(userId);
  if (!t.completed && !t.active) {
    const deck = t.deck(kind);
    if (deck.steps.length > 1) await insertSession(userId, deck, t.now);
  }
  revalidatePath("/");
}

export async function openDeckLesson(topicId: string) {
  const userId = await requireUserId();
  const t = await requireCurrentStep(userId, "lesson", topicId);
  const current = await getLessonProgress(userId, topicId);
  if (current?.state === "learned" || current?.state === "recalled") {
    await advanceLessonStep(userId, t.day, topicId, "passed", t.now);
  } else {
    const next = progressOnOpen(current);
    if (next !== current) await saveLessonProgress(userId, topicId, next);
  }
  revalidatePath("/");
}

// Called from the lesson's closing screen, so that screen stays up until the learner moves on.
export async function finishDeckLesson(topicId: string) {
  const userId = await requireUserId();
  const t = await requireCurrentStep(userId, "lesson", topicId);
  const current = await getLessonProgress(userId, topicId);
  let outcome: "passed" | "failed";
  if (current?.state === "learned" || current?.state === "recalled") {
    outcome = "passed";
  } else if ((await countFirstCheckAnswers(userId, topicId, t.active!.startedAt)) >= 2 * FIRST_CHECK_ITEMS) {
    // Both attempts of the first check were answered this session and the lesson is still in progress.
    outcome = "failed";
  } else {
    throw new Error(`${topicId} is not finished`);
  }
  await advanceLessonStep(userId, t.day, topicId, outcome, t.now);
  revalidatePath("/");
}

export type ReviewAnswer = { itemId: string; response: Response };

export async function submitProbe(topicId: string, answer: ReviewAnswer) {
  const userId = await requireUserId();
  const t = await requireCurrentStep(userId, "probe", topicId);
  const [pack, row] = await Promise.all([getLessonPack(topicId), getReviewProgress(userId, topicId)]);
  if (!pack) throw new Error(`no lesson pack for ${topicId}`);
  if (!row || (row.state !== "learned" && row.state !== "recalled") || row.box === null || row.dueAt === null) {
    throw new Error(`${topicId} is not scheduled for a probe`);
  }
  const item = probeItem(pack);
  if (answer.itemId !== item.id) throw new Error("answer the probe item");
  const grade = gradeResponse(item, answer.response);
  const next = applyProbe(
    {
      topicId,
      state: row.state,
      box: row.box,
      dueAt: row.dueAt,
      lastReviewedDay: row.lastReviewedAt ? sessionDay(row.lastReviewedAt, t.tz) : null,
      successStreak: row.successStreak,
      failStreak: row.failStreak,
      lapsed: row.lapsed,
    },
    isCorrect(grade),
    t.day,
    await scheduledReviewCounts(userId, topicId),
  );
  await recordProbe(userId, t.day, t.now, { itemId: item.id, grade }, next, isCorrect(grade));
  revalidatePath("/");
  revalidatePath("/map");
}

export async function submitReview(topicId: string, answers: ReviewAnswer[]) {
  const userId = await requireUserId();
  const t = await requireCurrentStep(userId, "review", topicId);
  const [pack, row, history] = await Promise.all([
    getLessonPack(topicId),
    getReviewProgress(userId, topicId),
    getTopicHistory(userId, topicId),
  ]);
  if (!pack) throw new Error(`no lesson pack for ${topicId}`);
  if (!row || (row.state !== "learned" && row.state !== "recalled") || row.box === null || row.dueAt === null) {
    throw new Error(`${topicId} is not scheduled for review`);
  }

  const items = pickReviewItems(pack, history);
  const answered = new Set(answers.map((a) => a.itemId));
  if (answers.length !== 2 || !items.every((i) => answered.has(i.id))) {
    throw new Error("answer each review item exactly once");
  }
  const grades = items.map((item) => ({
    itemId: item.id,
    grade: gradeResponse(item, answers.find((a) => a.itemId === item.id)!.response),
  }));

  const next = applyReview(
    {
      topicId,
      state: row.state,
      box: row.box,
      dueAt: row.dueAt,
      lastReviewedDay: row.lastReviewedAt ? sessionDay(row.lastReviewedAt, t.tz) : null,
      successStreak: row.successStreak,
      failStreak: row.failStreak,
      lapsed: row.lapsed,
    },
    grades.map((g) => g.grade),
    t.day,
  );
  await recordReview(userId, t.day, t.now, grades, next, grades.filter((g) => isCorrect(g.grade)).length);

  revalidatePath("/");
  revalidatePath("/map");
}
