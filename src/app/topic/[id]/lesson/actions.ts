"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type FirstCheckAttempt,
  type FirstCheckOutcome,
  firstCheckItems,
  firstCheckOutcome,
  progressAfterFirstCheck,
  progressOnCard,
  progressOnOpen,
} from "@/core/firstCheck";
import { gradeResponse, type Response } from "@/core/grading";
import { sessionDay } from "@/core/scheduler";
import { CURRENT_USER_ID } from "@/db/currentUser";
import {
  getLessonPack,
  getLessonProgress,
  getUserTz,
  recordFirstCheck,
  saveLessonProgress,
} from "@/db/lessonProgress";

async function requirePack(topicId: string) {
  const pack = await getLessonPack(topicId);
  if (!pack) throw new Error(`no lesson pack for ${topicId}`);
  return pack;
}

function validTz(tz: string): string | null {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

export async function startLesson(topicId: string) {
  await requirePack(topicId);
  const current = await getLessonProgress(CURRENT_USER_ID, topicId);
  const next = progressOnOpen(current);
  if (next !== current) await saveLessonProgress(CURRENT_USER_ID, topicId, next);
  revalidatePath(`/topic/${topicId}`);
  redirect(`/topic/${topicId}/lesson`);
}

export async function saveCardIndex(topicId: string, index: number) {
  const pack = await requirePack(topicId);
  const current = await getLessonProgress(CURRENT_USER_ID, topicId);
  if (!current) throw new Error(`${topicId} has not been opened`);
  const next = progressOnCard(current, index, pack.cards.length);
  if (next !== current) await saveLessonProgress(CURRENT_USER_ID, topicId, next);
}

export type FirstCheckAnswer = { itemId: string; response: Response };

export async function submitFirstCheck(
  topicId: string,
  attempt: FirstCheckAttempt,
  answers: FirstCheckAnswer[],
  browserTz: string,
): Promise<{ outcome: FirstCheckOutcome; dueAt: string | null }> {
  const pack = await requirePack(topicId);
  const current = await getLessonProgress(CURRENT_USER_ID, topicId);
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

  const now = new Date();
  const tz = (await getUserTz(CURRENT_USER_ID)) ?? validTz(browserTz) ?? "UTC";
  const next = progressAfterFirstCheck(current, outcome, {
    now,
    today: sessionDay(now, tz),
    cardCount: pack.cards.length,
  });
  await recordFirstCheck(CURRENT_USER_ID, topicId, now, grades, next);

  revalidatePath("/map");
  revalidatePath(`/topic/${topicId}`);
  return { outcome, dueAt: next.dueAt };
}
