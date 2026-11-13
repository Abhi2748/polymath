import { z } from "zod";

// Mirrors data/lesson.schema.json (format polymath.lesson/1). Keep the two in step.

// JSON Schema measures string length in code points, not UTF-16 units.
function text(opts: { min?: number; max?: number; pattern?: RegExp } = {}) {
  let s = z.string();
  if (opts.pattern) s = s.regex(opts.pattern);
  if (opts.min === undefined && opts.max === undefined) return s;
  return s.refine(
    (v) => {
      const n = [...v].length;
      return (opts.min === undefined || n >= opts.min) && (opts.max === undefined || n <= opts.max);
    },
    { message: `length must be between ${opts.min ?? 0} and ${opts.max ?? "any"} characters` },
  );
}

const topicId = text({ pattern: /^[a-z]{3}[0-9]{2}$/ });
const isoDate = text({ pattern: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/ });
const httpsUrl = text({ pattern: /^https:\/\// });
const int = z.number().int();

const option = z.strictObject({ id: z.string(), text: z.string() });

const svgVisual = z.strictObject({
  kind: z.literal("svg"),
  alt: text({ min: 5 }),
  svg: text({ pattern: /^<svg/, max: 8000 }),
  caption: z.string().optional(),
});

const chartVisual = z.strictObject({
  kind: z.literal("chart"),
  alt: text({ min: 5 }),
  caption: z.string().optional(),
  chart: z.strictObject({
    type: z.enum(["line", "bar", "scatter"]),
    x_label: z.string(),
    y_label: z.string(),
    series: z
      .array(
        z.strictObject({
          name: z.string(),
          points: z.array(z.tuple([z.union([z.number(), z.string()]), z.number()])).min(2),
        }),
      )
      .min(1)
      .max(4),
  }),
});

const imageVisual = z.strictObject({
  kind: z.literal("image"),
  alt: text({ min: 5 }),
  src: z.string(),
  credit: z.string(),
  licence: z.string(),
  caption: z.string().optional(),
});

export const visualSchema = z.discriminatedUnion("kind", [svgVisual, chartVisual, imageVisual]);

export const recallItemSchema = z
  .strictObject({
    id: text({ pattern: /^r[0-9]+$/ }),
    kind: z.enum(["free_recall", "cloze", "mcq", "number", "apply", "explain", "true_false", "compare"]),
    prompt: z.string(),
    options: z.array(option).min(2).optional(),
    answer: z.string(),
    accept: z.array(z.string()).optional(),
    explanation: z.string().optional(),
    grading: z.enum(["auto", "self"]),
    first_check: z.boolean(),
    probe: z.boolean(),
  })
  .superRefine((item, ctx) => {
    const autoOnly = item.kind === "mcq" || item.kind === "cloze" || item.kind === "true_false";
    if (autoOnly && item.grading !== "auto") {
      ctx.addIssue({ code: "custom", path: ["grading"], message: `${item.kind} items must be auto-graded` });
    }
    if (item.kind === "mcq" && item.options === undefined) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "mcq items need options" });
    }
    if (item.kind === "cloze" && item.accept === undefined) {
      ctx.addIssue({ code: "custom", path: ["accept"], message: "cloze items need accept" });
    }
    if (item.kind === "true_false" && item.answer !== "true" && item.answer !== "false") {
      ctx.addIssue({ code: "custom", path: ["answer"], message: "true_false answer must be true or false" });
    }
  });

const recallItems = z
  .array(recallItemSchema)
  .min(6)
  .max(10)
  .superRefine((items, ctx) => {
    const probes = items.filter((i) => i.probe).length;
    const firstChecks = items.filter((i) => i.first_check).length;
    if (probes !== 1) {
      ctx.addIssue({ code: "custom", message: `exactly one probe item is required, found ${probes}` });
    }
    if (firstChecks !== 3) {
      ctx.addIssue({ code: "custom", message: `exactly three first_check items are required, found ${firstChecks}` });
    }
  });

export const cardSchema = z.strictObject({
  id: text({ pattern: /^c[0-9]+$/ }),
  kind: z.enum(["guess", "hook", "method", "numbers", "picture", "analogy", "idea", "myth", "takeaway"]),
  title: text({ max: 60 }),
  body_md: text({ max: 420 }),
  visual: visualSchema,
});

export const lessonPackSchema = z.strictObject({
  format: z.literal("polymath.lesson/1"),
  topic_id: topicId,
  title: text({ min: 1 }),
  question: text({ pattern: /\?$/ }),
  est_minutes: int.min(5).max(20),
  objectives: z.array(z.string()).min(1).max(3),
  key_terms: z.array(z.strictObject({ term: z.string(), definition: z.string() })),
  when: z
    .strictObject({ label: z.string(), start_year: int.optional(), end_year: int.optional() })
    .nullable()
    .optional(),
  guess: z.strictObject({
    prompt: z.string(),
    options: z.array(option).min(2).max(5),
    answer_id: z.string(),
    reveal: z.string(),
  }),
  hook: text({ max: 400 }),
  excerpt: z
    .strictObject({
      work: z.string(),
      author: z.string(),
      year: int,
      text: text({ min: 20, max: 2500 }),
      rights: z.enum(["public_domain", "open_licence"]),
      licence: z.string().optional(),
      source_url: httpsUrl,
      note: z.string().optional(),
    })
    .optional(),
  explanation: z.strictObject({
    body_md: z.string(),
    analogy: z.string(),
    takeaways: z.array(z.string()).min(2).max(4),
    visual: visualSchema,
  }),
  positions: z
    .array(
      z.strictObject({
        name: z.string(),
        claim: z.string(),
        best_argument: z.string(),
        main_objection: z.string(),
      }),
    )
    .min(2)
    .max(5)
    .optional(),
  worked_example: z.strictObject({ body_md: z.string() }),
  misconception: z.strictObject({ claim: z.string(), correction_md: z.string() }),
  cards: z.array(cardSchema).min(5).max(8),
  recall_items: recallItems,
  teach_back: z.strictObject({
    prompt: z.string(),
    rubric: z
      .array(z.strictObject({ id: z.string(), point: z.string() }))
      .min(3)
      .max(5),
    min_points: int.min(2),
    false_claims: z.array(z.string()),
  }),
  challenge: z.strictObject({
    kind: z.enum(["spot_the_flaw", "argue_other_side", "estimate", "predict"]),
    prompt: z.string(),
    model_answer: z.array(z.string()).min(1),
    follow_up: z.string().optional(),
  }),
  connections: z.array(z.strictObject({ to: topicId, body_md: z.string() })),
  deep_dive: z.strictObject({ body_md: z.string(), est_minutes: int }),
  go_further: z
    .array(
      z.strictObject({
        kind: z.enum(["short", "long", "book", "video", "lecture"]),
        title: z.string(),
        by: z.string().optional(),
        year: int.optional(),
        url: httpsUrl.optional(),
        note: z.string(),
        verified_on: isoDate.optional(),
      }),
    )
    .min(1)
    .max(4),
  sources: z
    .array(
      z.strictObject({
        id: z.string(),
        title: z.string(),
        url: httpsUrl,
        tier: z.enum(["research", "textbook", "reference", "institution", "popular"]),
        accessed: isoDate,
        supports: z.array(z.string()).min(1),
      }),
    )
    .min(1),
  verification: z.strictObject({
    status: z.enum(["draft", "verified", "flagged"]),
    checked_on: z.string(),
    notes: z.string(),
  }),
});

export type Visual = z.infer<typeof visualSchema>;
export type RecallItem = z.infer<typeof recallItemSchema>;
export type Card = z.infer<typeof cardSchema>;
export type LessonPack = z.infer<typeof lessonPackSchema>;
