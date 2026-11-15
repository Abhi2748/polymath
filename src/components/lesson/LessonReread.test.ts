import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { lessonPackSchema } from "@/core/lesson";
import { safeLessonPack } from "@/lib/safeLesson";
import { LessonReread } from "./LessonReread";

const load = (id: string) =>
  safeLessonPack(
    lessonPackSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "data", "lessons", `${id}.json`), "utf8"))),
  );

function render(id: string, connectionTitles: Record<string, string> = {}) {
  const pack = load(id);
  return { pack, html: renderToStaticMarkup(createElement(LessonReread, { pack, connectionTitles })) };
}

const at = (html: string, needle: string) => {
  const i = html.indexOf(needle);
  expect(i, `${needle} should be on the page`).toBeGreaterThan(-1);
  return i;
};

const allIds = readdirSync(join(process.cwd(), "data", "lessons"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -".json".length));

describe("LessonReread for every lesson", () => {
  it.each(allIds)("renders %s with every part it has", (id) => {
    const { pack, html } = render(id);
    for (const part of ["explanation", "worked-example", "misconception", "deep-dive", "go-further"]) {
      at(html, `id="${part}"`);
    }
    expect(html.includes('id="excerpt"')).toBe(pack.excerpt !== undefined);
    expect(html.match(/<article/g) ?? []).toHaveLength(pack.positions?.length ?? 0);
    for (const c of pack.connections) at(html, `href="/topic/${c.to}"`);
  });
});

describe("LessonReread with an excerpt (lit04)", () => {
  const { pack, html } = render("lit04");
  const excerpt = pack.excerpt!;

  it("shows the work, author and year", () => {
    at(html, excerpt.work);
    at(html, excerpt.author);
    at(html, String(excerpt.year));
  });

  it("keeps the excerpt's line breaks", () => {
    const [first, second] = excerpt.text.split("\n");
    at(html, `${first}\n${second}`);
    expect(html).toMatch(/<blockquote[^>]*whitespace-pre-line/);
  });

  it("shows the excerpt before the explanation", () => {
    expect(at(html, excerpt.author)).toBeLessThan(at(html, 'id="explanation"'));
  });
});

describe("LessonReread with positions (pol06)", () => {
  const { pack, html } = render("pol06", { eco15: "Markets and the state" });
  const positions = pack.positions!;

  it("shows one block per view", () => {
    expect(html.match(/<article/g)).toHaveLength(positions.length);
    for (const p of positions) at(html, `>${p.name}</h3>`);
  });

  it("shows the positions under the explanation and before the worked example", () => {
    const positionsAt = at(html, 'id="positions"');
    expect(positionsAt).toBeGreaterThan(at(html, 'id="explanation"'));
    expect(positionsAt).toBeLessThan(at(html, 'id="worked-example"'));
  });

  it("has no excerpt", () => {
    expect(html).not.toContain("<blockquote");
  });

  it("links each connection to its topic, by title when known", () => {
    at(html, 'href="/topic/eco15"');
    at(html, "Markets and the state");
    for (const c of pack.connections) at(html, `href="/topic/${c.to}"`);
  });

  it("shows the parts in order, with the deep dive collapsed", () => {
    const order = ["explanation", "positions", "worked-example", "misconception", "connections", "deep-dive", "go-further"];
    const found = order.map((id) => at(html, `id="${id}"`));
    expect(found).toEqual([...found].sort((a, b) => a - b));
    expect(html).toMatch(/<details(?![^>]*\bopen\b)[^>]*>/);
  });

  it("lists every go-further item", () => {
    for (const g of pack.go_further) at(html, g.title.replace(/&/g, "&amp;"));
  });
});
