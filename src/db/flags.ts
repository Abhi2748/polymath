import { desc, eq, inArray } from "drizzle-orm";
import { type LessonPack, lessonPackSchema } from "@/core/lesson";
import { db } from "./client";
import { flags, lessons, topics } from "./schema";

export async function insertFlag(userId: string, topicId: string, ref: string, note: string) {
  await db.insert(flags).values({ userId, topicId, ref, note });
}

export async function listFlags(userId: string) {
  const rows = await db
    .select({
      id: flags.id,
      topicId: flags.topicId,
      topicTitle: topics.title,
      ref: flags.ref,
      note: flags.note,
      createdAt: flags.createdAt,
    })
    .from(flags)
    .innerJoin(topics, eq(topics.id, flags.topicId))
    .where(eq(flags.userId, userId))
    .orderBy(desc(flags.createdAt), desc(flags.id));

  const topicIds = [...new Set(rows.map((r) => r.topicId))];
  const packRows =
    topicIds.length > 0
      ? await db.select({ topicId: lessons.topicId, pack: lessons.pack }).from(lessons).where(inArray(lessons.topicId, topicIds))
      : [];
  const packs = new Map<string, LessonPack>();
  for (const p of packRows) {
    const parsed = lessonPackSchema.safeParse(p.pack);
    if (parsed.success) packs.set(p.topicId, parsed.data);
  }
  return rows.map((r) => ({ ...r, pack: packs.get(r.topicId) ?? null }));
}
