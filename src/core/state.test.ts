import { describe, expect, it } from "vitest";
import { type ProgressRow, type TopicRef, topicMapState } from "./state";

const topic: TopicRef = { id: "lrn02", fieldCode: "LRN" };
const prereq: TopicRef = { id: "lrn01", fieldCode: "LRN" };
const otherPrereq: TopicRef = { id: "mat01", fieldCode: "MAT" };

function row(topicId: string, state: ProgressRow["state"], lapsed = false): ProgressRow {
  return { topicId, state, lapsed };
}

function stateOf(overrides: Partial<Parameters<typeof topicMapState>[0]> = {}) {
  return topicMapState({ topic, prereqs: [], progress: [], fieldsOff: [], hasPack: true, ...overrides });
}

describe("topicMapState", () => {
  it("is not_written when there is no lesson pack", () => {
    expect(stateOf({ hasPack: false })).toBe("not_written");
  });

  it("is not_written without a pack even when every prerequisite is met", () => {
    expect(stateOf({ hasPack: false, prereqs: [prereq], progress: [row("lrn01", "learned")] })).toBe("not_written");
  });

  it("is ready with a pack and no prerequisites", () => {
    expect(stateOf()).toBe("ready");
  });

  it("treats a progress row in state new like no row", () => {
    expect(stateOf({ progress: [row("lrn02", "new")] })).toBe("ready");
  });

  it("is locked while a prerequisite has no progress", () => {
    expect(stateOf({ prereqs: [prereq] })).toBe("locked");
  });

  it("is locked while a prerequisite is only in progress", () => {
    expect(stateOf({ prereqs: [prereq], progress: [row("lrn01", "in_progress")] })).toBe("locked");
  });

  it("is ready once a prerequisite is learned", () => {
    expect(stateOf({ prereqs: [prereq], progress: [row("lrn01", "learned")] })).toBe("ready");
  });

  it("is ready once a prerequisite is recalled", () => {
    expect(stateOf({ prereqs: [prereq], progress: [row("lrn01", "recalled")] })).toBe("ready");
  });

  it("is locked while a learned prerequisite is lapsed", () => {
    expect(stateOf({ prereqs: [prereq], progress: [row("lrn01", "learned", true)] })).toBe("locked");
  });

  it("is locked when only some prerequisites are met", () => {
    expect(stateOf({ prereqs: [prereq, otherPrereq], progress: [row("lrn01", "learned")] })).toBe("locked");
  });

  it("counts a prerequisite in a switched-off field as met", () => {
    expect(stateOf({ prereqs: [prereq, otherPrereq], progress: [row("lrn01", "learned")], fieldsOff: ["MAT"] })).toBe(
      "ready",
    );
  });

  it("counts a lapsed prerequisite in a switched-off field as met", () => {
    expect(stateOf({ prereqs: [otherPrereq], progress: [row("mat01", "learned", true)], fieldsOff: ["MAT"] })).toBe(
      "ready",
    );
  });

  it("ignores progress rows of other topics", () => {
    expect(stateOf({ progress: [row("lrn01", "learned")] })).toBe("ready");
  });

  it.each(["in_progress", "learned", "recalled"] as const)("shows the topic's own %s state", (state) => {
    expect(stateOf({ prereqs: [prereq], progress: [row("lrn02", state)] })).toBe(state);
  });

  it("stays learned while the topic itself is lapsed", () => {
    expect(stateOf({ progress: [row("lrn02", "learned", true)] })).toBe("learned");
  });
});
