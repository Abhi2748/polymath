import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lessonPackSchema } from "./lesson";
import { lessonSteps } from "./lessonSteps";

const load = (id: string) =>
  lessonPackSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "data", "lessons", `${id}.json`), "utf8")));

describe("lessonSteps", () => {
  it("puts the excerpt straight after the guess card (lit04)", () => {
    const pack = load("lit04");
    const steps = lessonSteps(pack);
    const guessAt = steps.findIndex((s) => s.kind === "card" && s.card.kind === "guess");
    expect(steps).toHaveLength(pack.cards.length + 1);
    expect(steps[guessAt + 1]).toEqual({ kind: "excerpt" });
    expect(steps.filter((s) => s.kind === "excerpt")).toHaveLength(1);
  });

  it("keeps the cards in their order around the excerpt (lit04)", () => {
    const pack = load("lit04");
    const cardIds = lessonSteps(pack).flatMap((s) => (s.kind === "card" ? [s.card.id] : []));
    expect(cardIds).toEqual(pack.cards.map((c) => c.id));
  });

  it("is just the cards when the pack has no excerpt (pol06)", () => {
    const pack = load("pol06");
    expect(lessonSteps(pack)).toEqual(pack.cards.map((card) => ({ kind: "card", card })));
  });

  const allIds = readdirSync(join(process.cwd(), "data", "lessons"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length));

  it.each(allIds)("shows every card of %s once, with the excerpt only if it has one", (id) => {
    const pack = load(id);
    const steps = lessonSteps(pack);
    expect(steps.flatMap((s) => (s.kind === "card" ? [s.card.id] : []))).toEqual(pack.cards.map((c) => c.id));
    expect(steps.filter((s) => s.kind === "excerpt")).toHaveLength(pack.excerpt ? 1 : 0);
  });
});
