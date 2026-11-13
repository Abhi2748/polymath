import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { sql } from "drizzle-orm";
import { lessonPackSchema, type LessonPack } from "../src/core/lesson";
import { db } from "../src/db/client";
import { lessons, topics } from "../src/db/schema";

const dir = join(process.cwd(), "data", "lessons");

async function main() {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const knownTopics = new Set((await db.select({ id: topics.id }).from(topics)).map((t) => t.id));

  const accepted: LessonPack[] = [];
  const refused: string[] = [];

  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch (err) {
      refused.push(`${file}: not valid JSON (${(err as Error).message})`);
      continue;
    }
    const result = lessonPackSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join("/") || "(top level)"}: ${i.message}`);
      refused.push(`${file}:\n    ${issues.join("\n    ")}`);
      continue;
    }
    const pack = result.data;
    if (basename(file, ".json") !== pack.topic_id) {
      refused.push(`${file}: file name does not match topic_id ${pack.topic_id}`);
      continue;
    }
    if (!knownTopics.has(pack.topic_id)) {
      refused.push(`${file}: topic ${pack.topic_id} is not in the topics table; run import:skeleton first`);
      continue;
    }
    accepted.push(pack);
  }

  if (accepted.length > 0) {
    await db
      .insert(lessons)
      .values(accepted.map((pack) => ({ topicId: pack.topic_id, pack, status: pack.verification.status })))
      .onConflictDoUpdate({
        target: lessons.topicId,
        set: { pack: sql`excluded.pack`, status: sql`excluded.status`, importedAt: sql`now()` },
        setWhere: sql`${lessons.pack} is distinct from excluded.pack or ${lessons.status} is distinct from excluded.status`,
      });
  }

  console.log(`imported ${accepted.length} of ${files.length} lesson files`);
  if (refused.length > 0) {
    console.error(`refused ${refused.length}:\n  ${refused.join("\n  ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
