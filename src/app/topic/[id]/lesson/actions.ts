"use server";

import { revalidatePath } from "next/cache";
import {
  type FirstCheckAttempt,
  type FirstCheckOutcome,
  firstCheckItems,
  firstCheckOutcome,
  progressAfterFirstCheck,
  progressOnCard,
} from "@/core/firstCheck";
import { gradeResponse, type Response } from "@/core/grading";
import { lessonSteps } from "@/core/lessonSteps";
import { sessionDay } from "@/core/scheduler";
import {
  getLessonPack,
  getLessonProgress,
  getUserTz,
  recordFirstCheck,
  saveLessonProgress,
} from "@/db/lessonProgress";
import { requireUserId } from "@/lib/auth";
import { appNow } from "@/lib/dev";
import { validTz } from "@/lib/timeZone";

async function requirePack(topicId: string) {
  const pack = await getLessonPack(topicId);
  if (!pack) throw new Error(`no lesson pack for ${topicId}`);
  return pack;
}

export async function saveCardIndex(topicId: string, index: number) {
  const userId = await requireUserId();
  const pack = await requirePack(topicId);
  const current = await getLessonProgress(userId, topicId);
  if (!current) throw new Error(`${topicId} has not been opened`);
  const next = progressOnCard(current, index, lessonSteps(pack).length);
  if (next !== current) await saveLessonProgress(userId, topicId, next);
}

export type FirstCheckAnswer = { itemId: string; response: Response };

export async function submitFirstCheck(
  topicId: string,
  attempt: FirstCheckAttempt,
  answers: FirstCheckAnswer[],
  browserTz: string,
): Promise<{ outcome: FirstCheckOutcome; dueAt: string | null }> {
  const userId = await requireUserId();
  const pack = await requirePack(topicId);
  const current = await getLessonProgress(userId, topicId);
  if (current?.state !== "in_progress") throw new Error(`${topicId} is not in progress`);

  const items = firstCheckItems(pack);
  const answered = new Set(answers.map((a) => a.itemId));
  if (answers.length !== items.length || !items.every((i) => answered.has(i.id))) {
    throw new Error("answer each first-check item exactly once");
  }
  const grades = answers.map((a) => ({
    itemId: a.itemId,
    grade: gradeResponse(items.find((i) => i.id === a.itemId)!, a.response),
  }));
  const outcome = firstCheckOutcome(attempt, grades.map((g) => g.grade));

  const now = appNow();
  const tz = (await getUserTz(userId)) ?? validTz(browserTz) ?? "UTC";
  const next = progressAfterFirstCheck(current, outcome, {
    now,
    today: sessionDay(now, tz),
    cardCount: lessonSteps(pack).length,
  });
  await recordFirstCheck(userId, topicId, now, grades, next);

  revalidatePath("/map");
  revalidatePath(`/topic/${topicId}`);
  return { outcome, dueAt: next.dueAt };
}
