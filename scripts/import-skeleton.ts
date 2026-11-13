import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { edges, fields, topicPrereqs, topics } from "../src/db/schema";

type Skeleton = {
  fields: {
    code: string;
    name: string;
    realm: string;
    kind: string;
    season: number | null;
    lens: string;
    level2: string[];
  }[];
  topics: {
    id: string;
    field: string;
    level: number;
    season: number;
    seq: number;
    title: string;
    question: string;
    prereqs: string[];
  }[];
  edges: { a: string; b: string; why: string }[];
};

const skeleton: Skeleton = JSON.parse(readFileSync(join(process.cwd(), "data", "skeleton.json"), "utf8"));

const excluded = (col: string) => sql.raw(`excluded.${col}`);

async function main() {
  await db.transaction(async (tx) => {
    await tx
      .insert(fields)
      .values(
        skeleton.fields.map((f) => ({
          code: f.code,
          name: f.name,
          realm: f.realm,
          kind: f.kind,
          season: f.season,
          lens: f.lens,
          level2: f.level2,
        })),
      )
      .onConflictDoUpdate({
        target: fields.code,
        set: {
          name: excluded("name"),
          realm: excluded("realm"),
          kind: excluded("kind"),
          season: excluded("season"),
          lens: excluded("lens"),
          level2: excluded("level2"),
        },
      });

    await tx
      .insert(topics)
      .values(
        skeleton.topics.map((t) => ({
          id: t.id,
          fieldCode: t.field,
          level: t.level,
          season: t.season,
          seq: t.seq,
          title: t.title,
          question: t.question,
        })),
      )
      .onConflictDoUpdate({
        target: topics.id,
        set: {
          fieldCode: excluded("field_code"),
          level: excluded("level"),
          season: excluded("season"),
          seq: excluded("seq"),
          title: excluded("title"),
          question: excluded("question"),
        },
      });

    // Nothing references these two tables, so replacing them keeps them exactly in step with the file.
    await tx.delete(topicPrereqs);
    await tx
      .insert(topicPrereqs)
      .values(skeleton.topics.flatMap((t) => t.prereqs.map((p) => ({ topicId: t.id, prereqId: p }))));

    await tx.delete(edges);
    await tx.insert(edges).values(skeleton.edges.map((e) => ({ a: e.a, b: e.b, why: e.why })));
  });

  console.log(
    `imported ${skeleton.fields.length} fields, ${skeleton.topics.length} topics, ` +
      `${skeleton.topics.reduce((n, t) => n + t.prereqs.length, 0)} prerequisites, ${skeleton.edges.length} edges`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
