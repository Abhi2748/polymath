export type MapState = "locked" | "ready" | "in_progress" | "learned" | "recalled" | "not_written" | "off";

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
  // Development only: treat every prerequisite as met.
  ignorePrereqs?: boolean;
};

export function prereqsMet(prereqs: TopicRef[], progress: ProgressRow[], fieldsOff: string[]): boolean {
  return prereqs.every((pre) => {
    if (fieldsOff.includes(pre.fieldCode)) return true;
    const p = progress.find((row) => row.topicId === pre.id);
    return !!p && (p.state === "learned" || p.state === "recalled") && !p.lapsed;
  });
}

// A switched-off field hides its topics' progress, because none of them is offered or reviewed while it is off.
export function topicMapState({ topic, prereqs, progress, fieldsOff, hasPack, ignorePrereqs }: MapStateInput): MapState {
  if (fieldsOff.includes(topic.fieldCode)) return "off";
  const own = progress.find((p) => p.topicId === topic.id);
  if (own && own.state !== "new") return own.state;
  if (!hasPack) return "not_written";

  const met = ignorePrereqs || prereqsMet(prereqs, progress, fieldsOff);
  return met ? "ready" : "locked";
}

export const mapStateLabel: Record<MapState, string> = {
  locked: "Locked",
  ready: "Ready",
  in_progress: "In progress",
  learned: "Learned",
  recalled: "Recalled",
  not_written: "Not written yet",
  off: "Off",
};
