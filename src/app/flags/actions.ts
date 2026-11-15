"use server";

import { revalidatePath } from "next/cache";
import { flagNote, isFlagRef } from "@/core/flags";
import { insertFlag } from "@/db/flags";
import { getLessonPack } from "@/db/lessonProgress";
import { requireUserId } from "@/lib/auth";

export async function addFlag(topicId: string, ref: string, rawNote: string) {
  const userId = await requireUserId();
  const pack = await getLessonPack(topicId);
  if (!pack || !isFlagRef(pack, ref)) throw new Error(`${topicId} has no card or question ${ref}`);
  const note = flagNote(rawNote);
  if (!note) throw new Error("the note is empty or too long");
  await insertFlag(userId, topicId, ref, note);
  revalidatePath("/flags");
}
