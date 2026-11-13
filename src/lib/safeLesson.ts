import sanitizeHtml from "sanitize-html";
import type { LessonPack, Visual } from "@/core/lesson";

const svgTags = [
  "svg",
  "g",
  "path",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "rect",
  "text",
  "tspan",
  "title",
  "desc",
  "defs",
  "marker",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
];

const svgAttributes = [
  "xmlns",
  "viewBox",
  "preserveAspectRatio",
  "role",
  "aria-label",
  "aria-hidden",
  "id",
  "transform",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "dx",
  "dy",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "d",
  "points",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-opacity",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "letter-spacing",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "clip-path",
  "marker-start",
  "marker-mid",
  "marker-end",
  "markerWidth",
  "markerHeight",
  "markerUnits",
  "refX",
  "refY",
  "orient",
];

// url(#id) points inside the drawing; anything else could load from elsewhere.
const unsafeValue = /url\s*\(\s*(?!['"]?#)|javascript:|expression\s*\(/i;

const options: sanitizeHtml.IOptions = {
  allowedTags: svgTags,
  allowedAttributes: { "*": svgAttributes },
  allowedSchemes: [],
  parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
  transformTags: {
    "*": (tagName, attribs) => ({
      tagName,
      attribs: Object.fromEntries(Object.entries(attribs).filter(([, v]) => !unsafeValue.test(v))),
    }),
  },
};

export function sanitizeSvg(svg: string): string {
  return sanitizeHtml(svg, options);
}

function safeVisual(visual: Visual): Visual {
  switch (visual.kind) {
    case "svg":
      return { ...visual, svg: sanitizeSvg(visual.svg) };
    case "image":
      return { ...visual, src: /^(https:\/\/|\/(?!\/))/.test(visual.src) ? visual.src : "" };
    case "chart":
      return visual;
  }
}

declare const sanitised: unique symbol;
export type SafeLessonPack = LessonPack & { readonly [sanitised]: true };

export function safeLessonPack(pack: LessonPack): SafeLessonPack {
  return {
    ...pack,
    explanation: { ...pack.explanation, visual: safeVisual(pack.explanation.visual) },
    cards: pack.cards.map((c) => ({ ...c, visual: safeVisual(c.visual) })),
  } as SafeLessonPack;
}
