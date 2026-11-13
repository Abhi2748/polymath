# Lesson pack format

One JSON file per topic in `data/lessons/`, named `<topic_id>.json`. The exact rules are in `data/lesson.schema.json`. The files already in `data/lessons/` are hand-written models, and `docs/MODEL_LESSONS.md` says which to imitate for which kind of topic.

Check lessons with `python scripts/validate_lessons.py` (needs `pip install jsonschema`).

## Parts

| Key | What it holds | Limits |
| --- | --- | --- |
| `format` | Always `polymath.lesson/1` | |
| `topic_id`, `title`, `question` | Must match the skeleton exactly | |
| `est_minutes` | Time for the lesson and first check | 5 to 20 |
| `objectives` | What the learner can do afterwards | 1 to 3 |
| `key_terms` | Terms this lesson defines, for the glossary | |
| `when` | A date or period for a timeline, or null | optional |
| `guess` | The question answered before the lesson, its options, the answer and a one-line reveal | 2 to 5 options |
| `hook` | Why this matters | up to 400 characters |
| `excerpt` | A passage of a primary text the lesson studies: `work`, `author`, `year`, `text`, `rights`, `source_url` | optional; see Excerpts |
| `explanation` | `body_md`, one `analogy`, `takeaways` and a `visual` | about 300 words |
| `positions` | For a contested topic only: each view's `name`, `claim`, `best_argument` and `main_objection` | optional, 2 to 5 |
| `worked_example` | One concrete case | |
| `misconception` | The wrong `claim` and its `correction_md` | |
| `cards` | What the deck shows, one idea per card | 5 to 8, each with a visual |
| `recall_items` | Questions for the first check and for reviews | 6 to 10 |
| `teach_back` | Prompt, rubric points, points needed, false claims that fail it | used from release 2 |
| `challenge` | A thinking task with a model answer | used from release 2 |
| `connections` | Each connected topic with two or three sentences | must cover every skeleton connection |
| `deep_dive` | The optional longer read | 600 to 1,200 words |
| `go_further` | Checked resources: short, long, book, video or lecture | 1 to 4 |
| `sources` | What each fact was checked against, with a tier | at least two for a verified lesson |
| `verification` | `draft`, `verified` or `flagged`, with notes | |

Text fields ending in `_md` are Markdown. Tables are allowed in `explanation.body_md` and `deep_dive.body_md` only.

## Visuals

Every card and every explanation has a `visual`. A visual must show the card's idea. A picture that carries no meaning is not allowed. When an idea has no natural picture, use a large key number or term drawn as type.

| Kind | Fields | Use for |
| --- | --- | --- |
| `svg` | `alt`, `svg` | Diagrams and simple drawings |
| `chart` | `alt`, `chart` with `type`, `x_label`, `y_label`, `series` | Real data, drawn by the app |
| `image` | `alt`, `src`, `credit`, `licence` | Photos and artworks with a known licence |

Rules for `svg`:

- `viewBox="0 0 320 180"`, at most 8,000 characters.
- Use `currentColor` for ink and `var(--accent, #3b82f6)` for emphasis, so the drawing follows the theme.
- No scripts, event handlers, external links, embedded images or `foreignObject`.
- `alt` describes what the picture shows in one sentence.
- Keep labels short and inside the frame. The validator estimates each label's width and rejects a drawing whose text probably runs off the edge.

Rules for `chart`: points are `[x, y]` pairs. Use real figures from a source in the lesson, or figures worked out in the lesson's own example. In the second case the caption must say so.

## Recall items

| Kind | Graded | Needs |
| --- | --- | --- |
| `mcq` | automatically | `options`, and `answer` set to an option id |
| `cloze` | automatically | `accept`, the list of accepted answers |
| `true_false` | automatically | `answer` of `true` or `false` |
| `free_recall`, `number`, `apply`, `explain`, `compare` | by the learner | `answer`, shown after they respond |

Exactly three items have `first_check: true`. Exactly one has `probe: true`: the single question that best tests whether the topic survived a long break, and it must also be a first-check item. Mix the kinds: at least one item that asks the learner to apply the idea to a new case and one that asks them to explain why.

## Contested topics

When experts still disagree, the lesson must include `positions` and must not pick a winner. The guess-first question asks about something factual, such as which view is most widely held. Recall items test what each view says and why. The teach-back's `false_claims` should include saying the question is settled.

## Sources

Each source has a `tier`: `research`, `textbook`, `reference`, `institution` or `popular`. A fact must rest on one of the first four. A verified lesson needs at least two different sources, at least one of them research, textbook or reference, and should draw on two publishers. Every address in `sources` and `go_further` must have been opened and read before it is listed. `docs/RESEARCH_PROTOCOL.md` says how the pipeline proves this.

## Excerpts

Some topics are about a text: a poem, a speech, a page of a founding document. Put the passage in `excerpt` and the app shows it before the explanation. Only two kinds of text may be quoted at length: works first published before 1929 (`rights: public_domain`) and works under an open licence (`rights: open_licence`, with the `licence` named). The validator rejects anything else. For a modern text, describe it and link to it instead.

Anything the writer reasons out beyond the sources, such as an analogy or an application, is allowed but must be worded as reasoning and noted in `verification.notes`.
