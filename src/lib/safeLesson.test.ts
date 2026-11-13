import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lessonPackSchema } from "@/core/lesson";
import { safeLessonPack, sanitizeSvg } from "./safeLesson";

const lessonsDir = join(process.cwd(), "data", "lessons");
const packs = readdirSync(lessonsDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => lessonPackSchema.parse(JSON.parse(readFileSync(join(lessonsDir, f), "utf8"))));
const svgs = packs.flatMap((p) =>
  [p.explanation.visual, ...p.cards.map((c) => c.visual)].flatMap((v) => (v.kind === "svg" ? [v.svg] : [])),
);

const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">${inner}</svg>`;

describe("sanitizeSvg", () => {
  it("keeps theme colours and the viewBox", () => {
    const out = sanitizeSvg(
      wrap('<path d="M0 0h10" stroke="currentColor"/><text x="1" y="2" fill="var(--accent, #3b82f6)">Hi</text>'),
    );
    expect(out).toContain('viewBox="0 0 320 180"');
    expect(out).toContain('stroke="currentColor"');
    expect(out).toContain('fill="var(--accent, #3b82f6)"');
    expect(out).toContain(">Hi</text>");
  });

  it("keeps self-closed elements as siblings, not parents", () => {
    expect(sanitizeSvg(wrap('<circle r="2"/><path d="M0 0"/><text>a</text>'))).toBe(
      wrap('<circle r="2"></circle><path d="M0 0"></path><text>a</text>'),
    );
  });

  it("removes scripts and event handlers", () => {
    const out = sanitizeSvg(wrap('<script>alert(1)</script><rect width="5" height="5" onclick="alert(2)"/>'));
    expect(out).not.toMatch(/script|alert|onclick/i);
    expect(out).toContain("<rect");
  });

  it("removes foreignObject, embedded images, links and styles", () => {
    const out = sanitizeSvg(
      wrap(
        '<foreignObject><div>x</div></foreignObject><image href="https://evil.example/a.png"/>' +
          '<a href="javascript:alert(1)"><text>t</text></a><style>*{fill:red}</style>',
      ),
    );
    expect(out).not.toMatch(/foreignObject|<div|<image|<a |href|javascript|<style|fill:red/i);
  });

  it("drops attribute values that load from elsewhere but keeps internal references", () => {
    const out = sanitizeSvg(wrap('<rect fill="url(https://evil.example/x)"/><rect fill="url(#grad)"/>'));
    expect(out).not.toContain("evil.example");
    expect(out).toContain('fill="url(#grad)"');
  });

  it.each(svgs.map((svg, i) => [i, svg]))("leaves lesson drawing %i intact", (_, svg) => {
    const tagCount = (s: string) => (s.match(/<[a-zA-Z]/g) ?? []).length;
    const out = sanitizeSvg(svg);
    expect(tagCount(out)).toBe(tagCount(svg));
    expect((out.match(/currentColor/g) ?? []).length).toBe((svg.match(/currentColor/g) ?? []).length);
    expect((out.match(/--accent/g) ?? []).length).toBe((svg.match(/--accent/g) ?? []).length);
  });
});

describe("safeLessonPack", () => {
  it("sanitises every svg visual in the pack", () => {
    const pack = structuredClone(packs[0]);
    const card = pack.cards.find((c) => c.visual.kind === "svg")!;
    if (card.visual.kind === "svg") card.visual.svg = wrap('<rect onload="alert(1)"/>');
    const safe = safeLessonPack(pack);
    const out = safe.cards.find((c) => c.id === card.id)!.visual;
    expect(out.kind === "svg" && out.svg).not.toContain("onload");
  });

  it("blanks an image source that is not https or a local path", () => {
    const pack = structuredClone(packs[0]);
    pack.cards[0].visual = { kind: "image", alt: "A picture", src: "javascript:alert(1)", credit: "c", licence: "l" };
    const out = safeLessonPack(pack).cards[0].visual;
    expect(out.kind === "image" && out.src).toBe("");
  });
});
