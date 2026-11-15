# Research protocol

The site is only as good as its lessons, and a lesson is only as good as the research under it. This document fixes how much research every lesson gets, and makes that amount a property of the pipeline's code and files, so that it stays the same whichever language model does the writing.

## The principle

**The model writes. Code decides whether the research was done.**

A language model left alone will write a fluent lesson from memory, and a weaker model will do so with more mistakes. So the pipeline never asks the model "have you researched this?". It makes the model show its work in a form that code can check, and it refuses to continue when the work is missing.

A weaker model gets smaller steps, more steps and more retries. It never gets a lower bar. A model that cannot clear the bar is not used for lessons (see [Qualifying a model](#qualifying-a-model)).

## What the hand-written lessons had

The thirteen model lessons in `data/lessons/` set the standard. Each was written with two or three sources open and read in full, at least one of them a textbook, a research paper or a reference work, and every fact in the lesson can be traced to one of them. Anything beyond the sources, such as an analogy or an invented example, is labelled in the text or in `verification.notes`.

The protocol asks every generated lesson for the same, and proves it with a record.

| Requirement | Minimum | Checked by |
| --- | --- | --- |
| Sources fetched and saved | 3 | code |
| Sources from the research, textbook or reference tiers | 2 | code |
| Different publishers among the sources | 2 | code |
| Source text on the topic | 3,000 words | code |
| Facts extracted, each with an exact quotation from its source | 25 | code (string match) |
| Sources that contribute at least 5 facts each | 2 | code |
| Factual claims in the lesson that map to a fact | all of them | second model call, then code |
| Numbers and years in the lesson traced to a fact or a checked calculation | all of them | code |
| Links in the lesson that were fetched | all of them | code |
| A person has read it | before `verified` | you |

If a topic cannot meet the source rows, the pipeline stops and adds the topic to `pipeline/needs_sources.txt`. It does not draft from memory instead.

## The stages

### 1. Find sources (code)

- Start from `pipeline/source_map.json`, which lists approved sources for each field, and from `pipeline/sources/<topic_id>.txt` if you have added addresses by hand (one per line, optionally followed by a tier).
- For each approved site, search that site for the topic's title and question and fetch the best candidates. The model may be asked one thing only: "is this page about this topic, yes or no?". It never supplies an address.
- Save each kept source under `pipeline/cache/<topic_id>/` as text, with its address, tier, publisher, date fetched, word count and a hash of the text.
- Check the source rows of the table. Stop if they are not met.

Tiers, best first: `research` (papers, including open ones on PubMed Central), `textbook` (OpenStax and other open textbooks), `reference` (Stanford Encyclopedia of Philosophy, Britannica, specialist glossaries), `institution` (museums, universities, agencies), `popular` (journalism, essays). A popular source may supply a story or a turn of phrase. It may not be the only support for anything a recall question tests.

### 2. Extract facts (model, verified by code)

- Split each source into pieces of at most 1,500 words. Send every piece, one at a time. Code walks through the pieces, so nothing depends on the model's attention span.
- For each piece the model returns facts in this shape:

```json
{"claim": "Darwin sailed on the Beagle from 1831 to 1836.",
 "quote": "exact words copied from the source, at most 300 characters",
 "kind": "date"}
```

- Code then checks each fact. The quotation must appear in the saved source text, character for character after spaces and quotation marks are normalised. Every number in the claim must also appear in the quotation. A fact that fails either check is thrown away.
- Code gives the surviving facts ids (`s1.f07`) and writes the **fact sheet**: `pipeline/cache/<topic_id>/facts.json`.
- Check the fact rows of the table. If there are too few, go back to stage 1 for another source.

This is the step that makes research depth independent of the model. A model can invent a claim, but it cannot invent a quotation that matches a saved file.

### 3. Cross-check (model, then code)

- The model groups facts from different sources that say the same thing. A fact found in two sources is marked `confirmed`.
- Where two sources disagree on a number, date or name, the pair goes into `conflicts`. A conflict is never settled by the model. The pipeline either drops both facts or stops for you. You may then tell it to report both values and say that sources differ, as the model lessons `rel06` and `art05` do with dates.
- Rule checked later by code: every answer in `recall_items` and every line of `takeaways` must rest on a fact that is `confirmed` or comes from the top three tiers.

### 4. Plan (model, checked by code)

The model writes an outline: the guess-first question, the misconception, the worked example and one line per card, each with the fact ids it will use. Code checks that every id exists. The plan is given the one or two model lessons closest in kind (`docs/MODEL_LESSONS.md`).

### 5. Draft in parts (model)

One call per part, each given the fact sheet, the plan and the matching part of a model lesson:

1. explanation, key terms, misconception, worked example
2. cards and their visuals
3. recall items, teach-back, challenge
4. connections
5. deep dive

For every part the model also returns a **claims list**: each sentence that states a fact, with the fact ids behind it. A sentence with no fact behind it must be labelled as one of `reasoning` (the writer's own inference), `example` (invented for teaching and described as such in the text) or `computed` (arithmetic, with the expression).

The lesson may contain only what is on the fact sheet, plus labelled reasoning, examples and calculations. General knowledge the model is sure of is not an exception. If it matters, find a source for it.

### 6. Claim check (a second model call, then code)

- A separate call, with a different model if you have one, receives the finished lesson and the fact sheet and nothing else. It lists every factual claim it can find in the lesson and marks each one `supported` (with a fact id), `unsupported` or `contradicted`.
- Code compares that list with the writer's claims list. Any `unsupported` or `contradicted` claim sends that part back for a redraft with the problem named.
- At most two redrafts per part. After that the lesson goes to `pipeline/rejected/` with the table.
- At most six items labelled `reasoning` per lesson, and each must be listed in `verification.notes`.

### 7. Number check (code only)

Code pulls every number and year out of the lesson text. Each must be found in the quotation of a fact the sentence cites, or in the `computed` list, where code evaluates the expression again and compares, or inside an `example` whose text says the numbers are invented. One unexplained number fails the lesson.

### 8. Link check (code only)

Every address in `sources` and `go_further` must be in the cache from stage 1 and must still answer when fetched again. Books without a link are allowed in `go_further` and are marked as not opened in the notes.

### 9. Format check and drawings

Run `scripts/validate_lessons.py`. Then render every drawing to one image sheet for a person to look at. See [Visuals](#visuals-with-any-model).

### 10. The research record

Write `pipeline/records/<topic_id>.json`: the tokens used and the cost of the run; every source with its address, tier, date, hash and word count; every fact with its quotation; the claims table with the checker's verdicts; the number table; the models and prompt versions used; and the counts for each row of the table at the top. Build `verification.notes` from this record, not from the model's own summary.

The record is what lets you, months later, answer "where did this sentence come from?" in under a minute.

### 11. You

The pack is written with `verification.status` set to `draft`. Before you change it to `verified`:

1. Read the lesson.
2. Run `python -m pipeline.audit <topic_id>`. It prints five claims chosen at random with their quotations and addresses. Open the addresses and check them. One failure rejects the lesson.
3. Look at the drawing sheet.

In the app, the error flag on every card is the last line of defence. A flagged lesson goes back through stages 6 to 11.

## Visuals with any model

Free-hand drawing is where weaker models fail first. The pipeline therefore offers two routes.

- **Templates (default).** `pipeline/visuals.py` holds a small set of drawings with parameters: a large number or term as type, two things compared side by side, a flow of three or four boxes, rows of dots with some highlighted, bars of different lengths, a timeline, a grid of labelled boxes. The model chooses a template and fills in the words and numbers. Code draws it, so the result always follows the rules in `docs/LESSON_FORMAT.md`. `pipeline/svg_helpers.py` contains the helper functions the model lessons were drawn with, as a starting point.
- **Free drawing.** Allowed only for a model that passed the drawing part of the qualifying test below.

Charts need no drawing: the model supplies the points, each traced to a fact or a calculation, and the app draws them.

## Qualifying a model

Before any model writes lessons for the site, test it on topics where the right answer is known.

```
python -m pipeline.qualify --model <name>
```

The command runs the whole pipeline for the thirteen model-lesson topics, using the same sources the hand-written lessons used (`pipeline/sources/<topic_id>.txt` is provided for each). It reports:

| Measure | Pass mark | What it tells you |
| --- | --- | --- |
| Facts whose quotation matched the source | 95% | Whether the model copies accurately or makes quotations up |
| Research recall: entries in the hand-written lesson's `sources[].supports` that the fact sheet covers | 85% | Whether it found what a careful reader found |
| Lessons passing stages 6 to 9 within two redrafts | 11 of 13 | Whether it can write inside the rules |
| Claims marked unsupported in the final lessons | 0 | Whether anything slipped through |
| Drawings a person accepts on the sheet | 9 of 10 | Whether it may draw freely or must use templates |

Then read two of its lessons next to the hand-written ones. If the teaching is clearly worse, the model fails even with good numbers.

Run the test again whenever you change the model or a prompt. Keep the reports under `pipeline/qualify/`.

## What changes for a weaker model, and what does not

| Changes | Does not change |
| --- | --- |
| Source pieces get smaller (down to 800 words) | The number and tiers of sources |
| Drafting is split into more calls | The number of facts required |
| More redrafts are allowed (up to four) | Exact quotation matching |
| Visuals come from templates only | The claim check and the number check |
| A stronger model does the claim check | You reading the lesson before it is verified |

Expect roughly 15 to 30 model calls per lesson. That is the price of research that can be checked.

## What the protocol cannot do

- It proves that every factual sentence traces to a real passage in a real source. It does not prove the source is right. That is why two tiers and two publishers are required, and why conflicts stop the pipeline.
- It does not judge whether the explanation teaches well, whether the analogy fits, or whether the reasoning labelled as reasoning is sound. You do, and the model lessons are the yardstick.
- Contested topics need a human more than any others. A lesson with `positions` should be read by someone who checks that each side would accept its description.
- Copyright: the pipeline quotes sources only inside the fact sheet, for checking. Lesson text is written in new words. A primary text may be quoted at length in `excerpt` only if it was first published before 1929 or carries an open licence, and the validator enforces this.
