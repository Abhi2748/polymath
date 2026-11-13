# Product

## What it is

A personal learning site that replaces Instagram. It teaches every major field from zero, makes the knowledge stick, trains thinking, and has no ceiling. It is built for one user first.

## Rules that settle arguments

1. Every session ends. No infinite feed.
2. The learner does something with every idea: guess, recall, explain or argue.
3. The site chooses what comes next.
4. Nothing learned is left to fade. Weak topics come back.
5. Facts come from checked sources, and links are real.

## The curriculum

- 24 fields in seven realms, plus a nine-topic starter unit on how to learn and two practice studios.
- 391 Level 1 topics, each one lesson built around one question, joined by 337 written connections across fields.
- Four seasons of about 100 topics. World History and Thinking Tools run all year.
- Three levels per field: literacy, working knowledge, depth.
- Generalist: Level 1 in every field and Level 2 in several. Polymath: Level 3 in three or more fields from different realms, Level 2 in most of the rest, and work that connects them.

The full design, including the lesson template, the daily deck and the rules for missed days, is in the design doc. `data/skeleton.json` holds the curriculum as data.

## Releases

1. Core: skeleton, lessons, daily deck, spaced review, track switches, plain map, error flag
2. Tutor: discussion and teach-back, feeding review
3. Studios: Japanese and sketching
4. Connection graph, which starts empty and grows as topics are learned
5. Mind board and question journal
6. Weekly synthesis and Levels 2 and 3
7. Other users and a phone app

Only release 1 has a build spec. Do not build ahead.

## Decisions worth knowing

- **No model is trained.** Lessons are written once by an existing model from stored sources, then fact-checked.
- **Every card has a visual that shows its idea.** Pictures that carry no meaning are not allowed.
- **Progress is by completion, never by date.** Missing a day costs nothing.
- **The plain map shows everything from day one. The connection graph shows only what has been learned.**
