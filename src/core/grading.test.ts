import { describe, expect, it } from "vitest";
import { gradeResponse, isCorrect } from "./grading";
import type { RecallItem } from "./lesson";

function item(overrides: Partial<RecallItem>): RecallItem {
  return {
    id: "r1",
    kind: "free_recall",
    prompt: "?",
    answer: "",
    grading: "self",
    first_check: false,
    probe: false,
    ...overrides,
  };
}

const mcq = item({
  kind: "mcq",
  grading: "auto",
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
  ],
  answer: "b",
});
const cloze = item({ kind: "cloze", grading: "auto", answer: "savings", accept: ["savings", "the savings"] });
const trueFalse = item({ kind: "true_false", grading: "auto", answer: "false" });
const selfGraded = item({ kind: "explain", grading: "self", answer: "Because." });

describe("gradeResponse", () => {
  it("marks an mcq right only for the answer option", () => {
    expect(gradeResponse(mcq, { kind: "auto", value: "b" })).toBe("correct");
    expect(gradeResponse(mcq, { kind: "auto", value: "a" })).toBe("wrong");
  });

  it("marks a true_false item against its answer", () => {
    expect(gradeResponse(trueFalse, { kind: "auto", value: "false" })).toBe("correct");
    expect(gradeResponse(trueFalse, { kind: "auto", value: "true" })).toBe("wrong");
  });

  it("accepts any listed cloze answer, ignoring case, spacing and a final full stop", () => {
    expect(gradeResponse(cloze, { kind: "auto", value: "  The   Savings. " })).toBe("correct");
    expect(gradeResponse(cloze, { kind: "auto", value: "SAVINGS" })).toBe("correct");
    expect(gradeResponse(cloze, { kind: "auto", value: "recall" })).toBe("wrong");
    expect(gradeResponse(cloze, { kind: "auto", value: "" })).toBe("wrong");
  });

  it("records the learner's own grade for a self-graded item", () => {
    expect(gradeResponse(selfGraded, { kind: "self", grade: "forgot" })).toBe("forgot");
    expect(gradeResponse(selfGraded, { kind: "self", grade: "partly" })).toBe("partly");
    expect(gradeResponse(selfGraded, { kind: "self", grade: "got_it" })).toBe("got_it");
  });

  it("refuses a response of the wrong kind", () => {
    expect(() => gradeResponse(selfGraded, { kind: "auto", value: "x" })).toThrow();
    expect(() => gradeResponse(mcq, { kind: "self", grade: "got_it" })).toThrow();
  });
});

describe("isCorrect", () => {
  it("counts correct and Got it as correct, everything else as wrong", () => {
    expect(isCorrect("correct")).toBe(true);
    expect(isCorrect("got_it")).toBe(true);
    expect(isCorrect("wrong")).toBe(false);
    expect(isCorrect("partly")).toBe(false);
    expect(isCorrect("forgot")).toBe(false);
  });
});
