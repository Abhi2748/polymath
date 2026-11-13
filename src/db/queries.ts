import { eq } from "drizzle-orm";
import skeleton from "../../data/skeleton.json";
import { type MapState, type ProgressRow, type TopicRef, topicMapState } from "@/core/state";
import { db } from "./client";
import { fields, lessons, topicPrereqs, topicProgress, topics, userSettings } from "./schema";

export type MapTopic = { id: string; title: string; state: MapState };
export type MapField = { code: string; name: string; topics: MapTopic[] };
export type MapRealm = { id: string; name: string; fields: MapField[] };

export type TopicDetail = {
  id: string;
  title: string;
  question: string;
  fieldName: string;
  state: MapState;
  prereqs: MapTopic[];
};

const fieldOrder = new Map(skeleton.fields.map((f, i) => [f.code, i]));

async function loadCurriculum(userId: string) {
  const [fieldRows, topicRows, prereqRows, lessonRows, progressRows, settingsRows] = await Promise.all([
    db.select().from(fields),
    db.select().from(topics).orderBy(topics.seq),
    db.select().from(topicPrereqs),
    db.select({ topicId: lessons.topicId }).from(lessons),
    db
      .select({ topicId: topicProgress.topicId, state: topicProgress.state, lapsed: topicProgress.lapsed })
      .from(topicProgress)
      .where(eq(topicProgress.userId, userId)),
    db.select({ fieldsOff: userSettings.fieldsOff }).from(userSettings).where(eq(userSettings.userId, userId)),
  ]);

  const progress = progressRows as ProgressRow[];
  const fieldsOff = settingsRows[0]?.fieldsOff ?? [];
  const withPack = new Set(lessonRows.map((l) => l.topicId));
  const byId = new Map(topicRows.map((t) => [t.id, t]));
  const prereqIds = new Map<string, string[]>();
  for (const p of prereqRows) {
    prereqIds.set(p.topicId, [...(prereqIds.get(p.topicId) ?? []), p.prereqId]);
  }

  const ref = (id: string): TopicRef => ({ id, fieldCode: byId.get(id)!.fieldCode });
  const stateOf = (id: string): MapState =>
    topicMapState({
      topic: ref(id),
      prereqs: (prereqIds.get(id) ?? []).map(ref),
      progress,
      fieldsOff,
      hasPack: withPack.has(id),
    });

  return { fieldRows, topicRows, byId, prereqIds, stateOf };
}

export async function getMap(userId: string): Promise<MapRealm[]> {
  const { fieldRows, topicRows, stateOf } = await loadCurriculum(userId);

  const sortedFields = [...fieldRows].sort(
    (a, b) => (fieldOrder.get(a.code) ?? Infinity) - (fieldOrder.get(b.code) ?? Infinity),
  );

  return skeleton.realms.map((realm) => ({
    id: realm.id,
    name: realm.name,
    fields: sortedFields
      .filter((f) => f.realm === realm.id)
      .map((f) => ({
        code: f.code,
        name: f.name,
        topics: topicRows
          .filter((t) => t.fieldCode === f.code)
          .map((t) => ({ id: t.id, title: t.title, state: stateOf(t.id) })),
      })),
  }));
}

export async function getTopic(userId: string, id: string): Promise<TopicDetail | null> {
  const { fieldRows, byId, prereqIds, stateOf } = await loadCurriculum(userId);
  const topic = byId.get(id);
  if (!topic) return null;

  return {
    id: topic.id,
    title: topic.title,
    question: topic.question,
    fieldName: fieldRows.find((f) => f.code === topic.fieldCode)?.name ?? topic.fieldCode,
    state: stateOf(topic.id),
    prereqs: (prereqIds.get(topic.id) ?? []).map((pid) => ({
      id: pid,
      title: byId.get(pid)!.title,
      state: stateOf(pid),
    })),
  };
}
