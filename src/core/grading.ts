import type { RecallItem } from "./lesson";

export type SelfGrade = "forgot" | "partly" | "got_it";
export type Grade = "correct" | "wrong" | SelfGrade;

export type Response = { kind: "auto"; value: string } | { kind: "self"; grade: SelfGrade };

function normalise(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "")
    .trim();
}

export function gradeResponse(item: RecallItem, response: Response): Grade {
  if (item.grading === "self") {
    if (response.kind !== "self") throw new Error(`${item.id} is self-graded`);
    return response.grade;
  }
  if (response.kind !== "auto") throw new Error(`${item.id} is auto-graded`);

  if (item.kind === "mcq" || item.kind === "true_false") {
    return response.value === item.answer ? "correct" : "wrong";
  }
  const given = normalise(response.value);
  const accepted = (item.accept ?? [item.answer]).map(normalise);
  return given !== "" && accepted.includes(given) ? "correct" : "wrong";
}

export function isCorrect(grade: Grade): boolean {
  return grade === "correct" || grade === "got_it";
}
