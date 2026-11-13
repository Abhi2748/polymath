export type MapState = "locked" | "ready" | "in_progress" | "learned" | "recalled" | "not_written";

export type TopicRef = { id: string; fieldCode: string };

export type ProgressRow = {
  topicId: string;
  state: "new" | "in_progress" | "learned" | "recalled";
  lapsed: boolean;
};

export type MapStateInput = {
  topic: TopicRef;
  prereqs: TopicRef[];
  progress: ProgressRow[];
  fieldsOff: string[];
  hasPack: boolean;
};

export function topicMapState({ topic, prereqs, progress, fieldsOff, hasPack }: MapStateInput): MapState {
  const own = progress.find((p) => p.topicId === topic.id);
  if (own && own.state !== "new") return own.state;
  if (!hasPack) return "not_written";

  const fieldOn = !fieldsOff.includes(topic.fieldCode);
  const prereqsMet = prereqs.every((pre) => {
    if (fieldsOff.includes(pre.fieldCode)) return true;
    const p = progress.find((row) => row.topicId === pre.id);
    return !!p && (p.state === "learned" || p.state === "recalled") && !p.lapsed;
  });
  return fieldOn && prereqsMet ? "ready" : "locked";
}

export const mapStateLabel: Record<MapState, string> = {
  locked: "Locked",
  ready: "Ready",
  in_progress: "In progress",
  learned: "Learned",
  recalled: "Recalled",
  not_written: "Not written yet",
};
