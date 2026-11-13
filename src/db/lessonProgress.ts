import { and, eq } from "drizzle-orm";
import type { LessonProgress } from "@/core/firstCheck";
import type { Grade } from "@/core/grading";
import { type LessonPack, lessonPackSchema } from "@/core/lesson";
import { db } from "./client";
import { itemHistory, lessons, topicProgress, userSettings } from "./schema";

export async function getLessonPack(topicId: string): Promise<LessonPack | null> {
  const [row] = await db.select({ pack: lessons.pack }).from(lessons).where(eq(lessons.topicId, topicId));
  return row ? lessonPackSchema.parse(row.pack) : null;
}

export async function getLessonProgress(userId: string, topicId: string): Promise<LessonProgress | null> {
  const [row] = await db
    .select({
      state: topicProgress.state,
      cardIndex: topicProgress.cardIndex,
      learnedAt: topicProgress.learnedAt,
      box: topicProgress.box,
      dueAt: topicProgress.dueAt,
    })
    .from(topicProgress)
    .where(and(eq(topicProgress.userId, userId), eq(topicProgress.topicId, topicId)));
  if (!row) return null;
  if (row.state === "explained" || row.state === "connected") {
    throw new Error(`state ${row.state} is not used in release 1`);
  }
  return { ...row, state: row.state };
}

export async function saveLessonProgress(userId: string, topicId: string, progress: LessonProgress) {
  await db
    .insert(topicProgress)
    .values({ userId, topicId, ...progress })
    .onConflictDoUpdate({ target: [topicProgress.userId, topicProgress.topicId], set: progress });
}

export async function getUserTz(userId: string): Promise<string | null> {
  const [row] = await db.select({ tz: userSettings.tz }).from(userSettings).where(eq(userSettings.userId, userId));
  return row?.tz ?? null;
}

export async function recordFirstCheck(
  userId: string,
  topicId: string,
  askedAt: Date,
  grades: { itemId: string; grade: Grade }[],
  progress: LessonProgress,
) {
  await db.transaction(async (tx) => {
    await tx
      .insert(itemHistory)
      .values(grades.map((g) => ({ userId, topicId, itemId: g.itemId, askedAt, grade: g.grade, context: "first_check" })));
    await tx
      .insert(topicProgress)
      .values({ userId, topicId, ...progress })
      .onConflictDoUpdate({ target: [topicProgress.userId, topicProgress.topicId], set: progress });
  });
}
