import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { describeFlagRef, EXCERPT_REF, flagNote, FLAG_NOTE_MAX, isFlagRef } from "./flags";
import { lessonPackSchema } from "./lesson";

const load = (id: string) =>
  lessonPackSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "data", "lessons", `${id}.json`), "utf8")));

const lrn01 = load("lrn01");
const lit04 = load("lit04");

describe("isFlagRef", () => {
  it("accepts every card id and every recall item id", () => {
    for (const c of lrn01.cards) expect(isFlagRef(lrn01, c.id)).toBe(true);
    for (const r of lrn01.recall_items) expect(isFlagRef(lrn01, r.id)).toBe(true);
  });

  it("accepts the excerpt only when the pack has one", () => {
    expect(isFlagRef(lit04, EXCERPT_REF)).toBe(true);
    expect(isFlagRef(lrn01, EXCERPT_REF)).toBe(false);
  });

  it("rejects ids the pack does not have", () => {
    expect(isFlagRef(lrn01, "c99")).toBe(false);
    expect(isFlagRef(lrn01, "r99")).toBe(false);
    expect(isFlagRef(lrn01, "")).toBe(false);
  });
});

describe("describeFlagRef", () => {
  it("names a card by its place in the lesson and its title", () => {
    expect(describeFlagRef(lrn01, "c5")).toBe("Card 5 · The forgetting curve");
  });

  it("counts the excerpt card when numbering cards (lit04)", () => {
    expect(describeFlagRef(lit04, "c1")).toBe("Card 1 · Guess first");
    expect(describeFlagRef(lit04, EXCERPT_REF)).toBe("Card 2 · Sonnet 73");
    expect(describeFlagRef(lit04, "c2")).toBe("Card 3 · Old age without the word");
  });

  it("names a question by its prompt", () => {
    const item = lrn01.recall_items[0];
    expect(describeFlagRef(lrn01, item.id)).toBe(`Question · ${item.prompt}`);
  });

  it("falls back to the raw ref when the pack no longer has it", () => {
    expect(describeFlagRef(lrn01, "c99")).toBe("c99");
    expect(describeFlagRef(null, "c1")).toBe("c1");
  });
});

describe("flagNote", () => {
  it("trims the note", () => {
    expect(flagNote("  the date is wrong \n")).toBe("the date is wrong");
  });

  it("refuses an empty note", () => {
    expect(flagNote("   ")).toBeNull();
  });

  it("refuses a note over the limit", () => {
    expect(flagNote("x".repeat(FLAG_NOTE_MAX))).toBe("x".repeat(FLAG_NOTE_MAX));
    expect(flagNote("x".repeat(FLAG_NOTE_MAX + 1))).toBeNull();
  });
});
