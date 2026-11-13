import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lessonPackSchema } from "./lesson";

const lessonsDir = join(process.cwd(), "data", "lessons");
const files = readdirSync(lessonsDir).filter((f) => f.endsWith(".json"));

function load(file: string) {
  return JSON.parse(readFileSync(join(lessonsDir, file), "utf8"));
}

describe("lesson pack schema", () => {
  it("finds lesson files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("accepts %s", (file) => {
    const result = lessonPackSchema.safeParse(load(file));
    expect(result.error?.issues).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it("rejects lrn01.json when a card's visual is removed", () => {
    const pack = load("lrn01.json");
    delete pack.cards[0].visual;
    expect(lessonPackSchema.safeParse(pack).success).toBe(false);
  });
});
