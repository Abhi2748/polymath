# Build spec: release 1

Release 1 is the smallest version worth opening every day: the daily deck, lessons, spaced review, the plain map, track switches and the error flag. This file is the source of truth for it. Where the code and this file disagree, the file wins or the file is changed first.

## 1. Scope

In release 1:

- Import of the curriculum skeleton and of lesson packs
- Lesson player with a visual on every card
- Topic-level spaced review
- Daily deck that ends
- Plain map of all fields and topics
- Settings: track switches, session length, new lessons per day, time zone, planned break
- Error flag on any card or question
- Rules for missed days, catch-up and the return check
- Sign-in for one person, deployed and installable on a phone
- A command-line content pipeline that writes lesson packs (section 12)

Not in release 1, so do not build them or leave hooks for them beyond what is written here: the tutor and discussions, teach-back grading, the Japanese and sketching studios, the connection graph, the Mind board, the question journal, the weekly synthesis, Levels 2 and 3, other users.

## 2. Product rules that code must respect

1. Every session ends. There is no feed and no "next" after the end screen.
2. The app chooses what comes next. The learner never picks from a list of lessons in the deck.
3. Progress moves only on completion. Nothing advances because a date passed.
4. Time away never marks anything as forgotten. Only a failed review does.
5. No streak that resets, no badges, no notifications in release 1.
6. One thing on screen at a time, phone first.

## 3. Stack

- Next.js (App Router) with TypeScript, deployed on Vercel
- Tailwind CSS
- Postgres on Supabase, accessed through Drizzle ORM
- Supabase Auth with an email magic link, restricted to the address in `ALLOWED_EMAIL`
- Vitest for unit tests
- Web app manifest so it installs to a phone home screen
- Content pipeline in Python under `pipeline/`, separate from the app

Use the current stable versions that the official create commands install. All scheduling and deck logic lives in pure functions under `src/core/` with no database or clock access: they take the current time as an argument. This is what makes them testable.

## 4. Data files

- `data/skeleton.json`: realms, levels, seasons, fields, studios, topics and edges. Topics carry `id, field, level, season, seq, title, question, prereqs, links, unlocks`.
- `data/lessons/<topic_id>.json`: one lesson pack per topic, in the format of `data/lesson.schema.json`, explained in `docs/LESSON_FORMAT.md`.
- `scripts/validate_lessons.py`: must pass before lessons are imported.

A topic with no lesson pack is shown on the map as "not written yet" and is never offered in the deck.

## 5. Database

Every learner table carries `user_id` even though there is one user, so more can be added later.

| Table | Columns | Notes |
| --- | --- | --- |
| `fields` | code (pk), name, realm, kind, season, lens, level2 (json) | kind is field, spine or starter |
| `topics` | id (pk), field_code, level, season, seq, title, question | from the skeleton |
| `topic_prereqs` | topic_id, prereq_id | |
| `edges` | a, b, why | cross-field connections; not shown in release 1 |
| `lessons` | topic_id (pk), pack (json), status, imported_at | the validated lesson pack |
| `user_settings` | user_id (pk), tz, session_minutes, max_new_per_day, fields_off (json), planned_return | defaults: 30, 2, [] |
| `topic_progress` | user_id, topic_id, state, card_index, learned_at, box, due_at, last_reviewed_at, success_streak, fail_streak, lapsed, parked | pk (user_id, topic_id) |
| `item_history` | id, user_id, topic_id, item_id, asked_at, grade, context | context is first_check, review or probe |
| `sessions` | id, user_id, session_day, kind, mode, started_at, completed_at, summary (json) | kind is full or short |
| `flags` | id, user_id, topic_id, ref, note, status, created_at | ref is a card or item id |

`state` is one of `new`, `in_progress`, `learned`, `recalled`. The states `explained` and `connected` exist in the enum for later releases and are never set in release 1.

## 6. Topic states and completion

- **new**: no progress row, or a row with state new.
- **in_progress**: the lesson was opened. `card_index` stores where the learner stopped. Reopening resumes at that card.
- **learned**: every card was seen and the first check was passed.
- **recalled**: `success_streak` reached 3.

The first check: right after the last card, ask the three recall items marked `first_check`. It passes with at least two correct. On a fail, show the explanation again and ask the three items again in a different order. A second fail leaves the lesson in progress, and it reopens at the first check next session.

At most two topics may be in progress. While two are, no new lesson is offered.

A topic is **unlocked** when its field is switched on, it has a lesson pack, and every prerequisite is learned or recalled and not lapsed. A prerequisite in a field that is switched off counts as met.

## 7. Review scheduler

The scheduling unit is the topic. A review asks two recall items from the topic's pack: prefer items not asked most recently, and never the same pair twice in a row.

Boxes and intervals in days:

| Box | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Interval | 1 | 3 | 7 | 16 | 35 | 75 | 150 | 300 |

When a topic becomes learned: box 1, due one day later.

Grading one question: auto-graded items are correct or wrong. Self-graded items show the answer and offer three buttons: Forgot, Partly, Got it. Got it counts as correct, the other two as wrong, and Partly is recorded.

Outcome of a review of two questions:

| Result | Box | Streaks |
| --- | --- | --- |
| Both correct | up one, at most 8 | success_streak + 1, fail_streak = 0, lapsed = false |
| One correct | unchanged | no change |
| None correct | back to 1 | success_streak = 0, fail_streak + 1 |

- **Long-gap bonus.** If both are correct and the days since `last_reviewed_at` are at least twice the current box's interval, the box goes up two.
- **Lapse.** When `fail_streak` reaches 2, set `lapsed = true`. It clears on the next review with both correct.
- **Due date.** `due_at` = review day + the new box's interval, shifted by a fixed amount between -10% and +10% derived from a hash of the topic id, so reviews do not bunch.
- **State.** `success_streak` of 3 or more sets state to recalled. A lapse sets it back to learned.

## 8. Days, sessions and modes

- **Session day.** The local date of (now minus 4 hours) in the user's time zone. A session at 2 a.m. belongs to the previous day.
- **Session.** One row per session day and kind. A full session is complete when every item in the deck is done. A short session is reviews only and never counts toward cadences.
- **Sessions count, dates do not.** "Every 7 sessions" means 7 completed full sessions.
- **Days away.** Session day minus the day of the last completed session of either kind.

| Days away | Mode | Review budget | New lessons |
| --- | --- | --- | --- |
| 0 to 3 | normal | 10 minutes | allowed, subject to the guard |
| 4 to 14 | catch_up | half the session | none until due reviews fit in 10 minutes |
| 15 or more | return_check | 15 minutes of probes | resume per section 10 |

Estimate 40 seconds per topic review and 20 seconds per probe.

**Overload guard**, applied in normal mode: no new lessons when the reviews due today would take more than 15 minutes, or when fewer than 70% of the last 7 sessions' reviews had both questions correct (only once there have been at least 10 such reviews).

## 9. Deck assembly

`buildDeck(now, settings, progress, history, skeleton, lessons)` returns an ordered list of steps and the mode. It is a pure function.

1. Work out the session day, days away and mode.
2. **Reviews.** Take topics with `due_at` on or before today, not parked, oldest first, until the review budget is used. The rest stay due for the next session.
3. **In-progress lessons.** Add any lesson in progress, resumed at its card.
4. **New lessons.** Skip this step if the mode or the guard forbids it, or if two lessons are in progress. Otherwise choose up to `max_new_per_day` (never more than 3 per session day in total, counting earlier sessions today), from unlocked topics in state new, by these rules in order:
   - **Starter first.** While any How to Learn topic is unlearned, choose only from that field, in sequence.
   - **Current season.** Otherwise choose only from the lowest-numbered season that still has unlearned topics in switched-on fields. Spine topics belong to seasons by number: Thinking Tools 1 to 10, 11 to 20, 21 to 30, 31 to 40, and World History 1 to 6, 7 to 12, 13 to 18, 19 to 24.
   - **Thinking Tools.** If 7 or more full sessions have passed since the last Thinking Tools lesson and one is unlocked, choose it.
   - **World History.** If 10 or more full sessions have passed since the last World History lesson and one is unlocked, choose it.
   - **Rotation.** Fill the rest from the other fields: take the field studied least recently, never one already used today, and pick its lowest-sequence unlocked topic.
5. **Consolidation.** When every topic of the current season in switched-on fields is learned, the next 7 full sessions offer no new lessons. Then the next season opens.
6. **End.** The last step is always the end screen: what was done, what is due next and when. It has no link to more content.

Each new lesson step is the cards followed by the first check. A deep dive is offered as an optional link on the lesson's last card and on the topic page, never as a deck step.

**Short day.** The Today screen offers "15-minute short day". It builds a deck of reviews only, up to 15 minutes.

## 10. Return check

Runs when days away is 15 or more, and continues across sessions until every learned or recalled topic has been probed.

1. Queue one probe per learned or recalled topic: the recall item marked `probe`.
2. Order the queue: prerequisites of the topics that would be offered next, then the rest by oldest `last_reviewed_at`.
3. Each session asks probes for up to 15 minutes.
4. **Pass.** Treat as a review with both correct, including the long-gap bonus. Spread the new due dates so that no day receives more than 10 minutes of reviews.
5. **Fail.** Box 1, due tomorrow, state back to learned if it was recalled. The next review of that topic starts with the lesson's cards again as a refresher. The state never returns to new.
6. New lessons resume as soon as the prerequisites of the next lessons have passed their probes and the reviews due fit in 10 minutes. The rest of the queue continues alongside.
7. If days away was 60 or more, the session length is 20 minutes for the first two sessions, 40 for the next two, then the setting.

A planned break set in Settings changes nothing in these rules. It only records the date, so that the Today screen says "Welcome back" in place of nothing.

## 11. Screens

- **Today** (`/`). Shows the mode, the estimated minutes and one button: Start. During a session it shows one step at a time with a thin progress bar. Offers the short day. After the end screen it shows "Done for today" until the next session day.
- **Lesson** (inside the deck, and `/topic/[id]` for re-reading). Cards are swiped or tapped through. The guess card requires a choice before moving on and reveals the answer. Every card shows its visual above its text. Visual kinds: `svg` is sanitised and inlined so it takes the text colour and the accent colour, `chart` is drawn by the app from its data (x values may be numbers or category labels), `image` is shown with its credit. A lesson with a `positions` part shows it on the topic page under the explanation, as one block per view.
- **Review step.** One question at a time. Auto-graded items check the answer. Self-graded items reveal the answer and ask Forgot, Partly or Got it.
- **Map** (`/map`). Realms, then fields, then topics in order, each with its state: locked, ready, in progress, learned, recalled, or not written yet. A topic page shows its question, state, prerequisites and, once learned, the lesson and deep dive to re-read.
- **Settings** (`/settings`). A switch per field grouped by realm, session length, new lessons per day (0 to 3), time zone, planned break date.
- **Flag.** A small control on every card and question opens a note box. Saving stores the topic, the card or item id and the note. `/flags` lists them.

Design: calm and plain. Large type, generous spacing, light and dark themes, one accent colour exposed as the CSS variable `--accent`. No red badges, counters of unread things, or celebratory animation.

## 12. Content pipeline, version 0

A Python command under `pipeline/` that writes one lesson pack: `python -m pipeline.write <topic_id>`. The full rules are in `docs/RESEARCH_PROTOCOL.md`, which is binding. In short:

1. **Find sources.** Use `pipeline/sources/<topic_id>.txt` if present, then the field's approved sites in `pipeline/source_map.json`. Save each source's text under `pipeline/cache/<topic_id>/` with its address, tier, publisher, date and hash. Require 3 sources, 2 from the research, textbook or reference tiers, 2 publishers and 3,000 words. If that fails, add the topic to `pipeline/needs_sources.txt` and stop.
2. **Extract facts.** Send every source to the model in pieces. Each fact comes back with an exact quotation. Code keeps only facts whose quotation is found in the saved text and whose numbers appear in the quotation. Require 25 facts. Write `facts.json`.
3. **Cross-check.** Mark facts found in two sources as confirmed. List conflicts and stop on them.
4. **Plan.** An outline in which every line names the fact ids it will use.
5. **Draft in parts,** each with a claims list that ties every factual sentence to fact ids or labels it reasoning, example or computed. Give the model the one or two model lessons closest in kind (`docs/MODEL_LESSONS.md`).
6. **Claim check** with a second model call that sees only the lesson and the fact sheet. Unsupported or contradicted claims send the part back, at most twice.
7. **Number check** in code: every number and year traces to a fact's quotation, a calculation that code evaluates again, or an example the text calls invented.
8. **Link check** in code: every address was fetched in step 1 and still answers.
9. **Validate** with `scripts/validate_lessons.py` and render the drawings to one sheet. A pack that fails goes to `pipeline/rejected/` with the reasons.
10. **Record.** Write `pipeline/records/<topic_id>.json` and build `verification.notes` from it.
11. Write the pack with `verification.status` set to `draft`. A person sets it to `verified` after reading it and running `python -m pipeline.audit <topic_id>`.

Other commands: `python -m pipeline.sources --check` (every site in the source map answers), `python -m pipeline.qualify --model <name>` (the qualifying test in the protocol), and `--dry-run` on `pipeline.write` (stages 1 to 3 only, then print the plan prompt).

Rules: the model never supplies an address. The lesson contains nothing factual that is not on the fact sheet. The model provider sits behind one function so it can be swapped, and the writer and the checker can be different models. Visuals come from templates in `pipeline/visuals.py` unless the model has passed the drawing part of the qualifying test.

## 13. Tests that must exist

Unit tests under `src/core/` with a fixed clock:

- Scheduler: each row of the outcome table, the long-gap bonus, a lapse after two fails, recovery from a lapse, the box ceiling.
- Session day: 01:30 belongs to the previous day, 04:30 to the current day, in a non-UTC time zone.
- Deck: starter topics come first and in order; never two lessons from one field in a day; the overload guard; the limit of two in progress; a Thinking Tools lesson after 7 sessions; nothing offered from a switched-off field; a topic without a pack is never offered.
- Modes: 3, 4, 14 and 15 days away pick the right mode.
- Return check: prerequisites probed first; a pass keeps the state; a fail drops recalled to learned and never to new; new lessons resume before the queue is empty.
- First check: two of three passes; a second fail leaves the lesson in progress.

Python tests under `pipeline/tests/` with saved source files and no network or model: a fact with a quotation that is not in the source is dropped; a fact whose number is missing from its quotation is dropped; a lesson with an untraced number fails; a `computed` entry with wrong arithmetic fails; a topic with two sources stops at stage 1; an address not in the cache fails the link check.

## 14. Done means

- A new account sees the starter lesson, finishes it, passes the first check and reaches the end screen.
- The next day the Today screen offers a review of that lesson.
- The map shows 391 topics with correct states.
- Switching a field off removes its topics from the deck.
- All tests in section 13 pass.
- The site is installed on a phone and works there.
