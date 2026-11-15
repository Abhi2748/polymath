# Building release 1 with Cursor, step by step

Eleven steps. Each has a goal, a prompt to paste into Cursor's Agent chat, and checks to run yourself before moving on. Do them in order.

## How to work

- **One step, one new chat.** Start a fresh Agent chat for every step, so old context does not leak in.
- **`AGENTS.md` does the briefing.** Cursor reads it automatically from the project root. It points the agent at the spec, so the prompts below can stay short.
- **Commit after every step.** If a step goes wrong, `git reset --hard` and try again with a clearer prompt. That is faster than arguing with broken code.
- **Run the checks yourself.** Do not accept "done" from the agent. The checks under each step are the test.
- **Paste errors back whole.** When something fails, paste the full error and say what you did. Do not describe it from memory.
- **Never let the agent edit `docs/BUILD_SPEC.md` on its own.** If the spec is wrong or unclear, stop, decide the rule yourself, change the spec, then continue.
- **Stay inside the step.** If the agent starts building the tutor, the graph or anything else from "Not in release 1", stop it.
- **Start learning now.** Read the sample lesson, The forgetting curve, in the design doc today, and answer its recall questions on paper tomorrow. Do not wait for the site.

## Step 0. Set up (you, about 30 minutes, no prompt)

1. Install Node.js (current LTS), pnpm, Python 3.11 or later, and git.
2. Create an empty folder, copy everything from this kit into it, run `git init` and make the first commit.
3. Create a free Supabase project. Note its database connection string, project URL and anon key.
4. Create a file `.env.local` with: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_EMAIL` (your address). Check that `.env.local` is in `.gitignore` before you commit anything.
5. Run `pip install jsonschema` then `python scripts/validate_lessons.py`. It must print `ok` for every lesson file.
6. Open the folder in Cursor.

## Step 1. Scaffold

**Goal:** an empty app that runs, with the folders the spec expects.

```
Read docs/BUILD_SPEC.md sections 1 to 3.

Scaffold the app in this folder without deleting the existing data/, docs/, scripts/ folders or AGENTS.md:
- Next.js App Router with TypeScript and Tailwind, using pnpm
- Drizzle ORM connected to Postgres through DATABASE_URL
- Vitest, with one passing placeholder test
- src/core/ for pure logic, src/db/ for schema and queries, src/app/ for screens
- A home page that only says "Polymath"

Do not build any feature yet. When done, tell me the exact commands to run the dev server and the tests.
```

**Check:** the dev server shows "Polymath". `pnpm test` passes. The kit's folders are untouched. Commit.

## Step 2. Database and skeleton import

**Goal:** the curriculum is in the database.

```
Read docs/BUILD_SPEC.md sections 4 and 5.

1. Write the Drizzle schema for every table in section 5, with the state enum from that section, and a migration.
2. Write scripts/import-skeleton.ts that loads data/skeleton.json into fields, topics, topic_prereqs and edges. It must be safe to run twice.
3. Write scripts/import-lessons.ts that loads every file in data/lessons/ into the lessons table. It must refuse a file that does not match data/lesson.schema.json, using a zod schema you derive from that JSON schema and keep in src/core/lesson.ts.
4. Add package scripts: db:migrate, import:skeleton, import:lessons.
5. Add tests: the zod schema accepts every file in data/lessons/ and rejects lrn01.json when a card's visual is removed.

Run the migration and both imports, then report the row counts per table.
```

**Check:** the counts are 25 fields, 391 topics, 337 edges, and one lesson per file in `data/lessons/`. Running the imports again changes nothing. Commit.

## Step 3. Plain map

**Goal:** you can see the whole curriculum.

```
Read docs/BUILD_SPEC.md sections 6 and 11 (Map).

Build /map: realms, then fields, then topics in sequence order, each topic showing its state. For now every topic's state comes from a pure function in src/core/state.ts that takes the topic, its prerequisites, the progress rows, the list of switched-off fields and whether a lesson pack exists, and returns locked, ready, in_progress, learned, recalled or not_written. Write tests for that function, including: a prerequisite in a switched-off field counts as met.

Also build /topic/[id]: the question, the state and the prerequisites with their states. No lesson content yet.

Phone first. Follow the design paragraph at the end of section 11.
```

**Check:** on a phone-width window the map lists 7 realms and 391 topics. Only "The forgetting curve" is ready. The other model lessons show as locked, because their prerequisites are not learned, and everything else is not written yet. Commit.

## Step 4. Lesson player

**Goal:** you can read the first lesson, with its pictures.

```
Read docs/BUILD_SPEC.md sections 6 and 11 (Lesson, Review step), and docs/LESSON_FORMAT.md.

Build the lesson player as components that take a lesson pack:
1. Cards one at a time, swipe or tap to move. The visual sits above the text.
2. Visual kinds: svg (sanitise it, then inline it so currentColor and --accent apply), chart (draw it from its data with a small charting library, labelled axes, one colour per series plus a legend), image (with its credit).
3. The guess card requires a choice, then shows whether it was right and the reveal text.
4. After the last card, the first check exactly as section 6 describes, using a question component that handles auto-graded and self-graded items as in section 7.
5. Finishing sets the topic to learned and schedules its first review per section 7. Stopping midway saves card_index and state in_progress.

Put the first-check and grading logic in src/core/ as pure functions with tests from section 13 (First check).

Temporarily add a "Start lesson" button on /topic/lrn01 so I can try it. Use a hard-coded user id for now.
```

**Check:** read the lesson end to end on your phone-width window. All eight cards show a picture. The curve on card 5 has two series. Close the tab midway and reopen: it resumes on the same card. Passing the first check marks the topic learned on the map. Commit.

## Step 5. Sign-in and deploy

**Goal:** the site is on your phone.

```
Read docs/BUILD_SPEC.md section 3.

1. Add Supabase Auth with an email magic link. Only the address in ALLOWED_EMAIL may sign in; anyone else sees a plain "This site is private" page. Every page except the sign-in page requires a session.
2. Replace the hard-coded user id with the signed-in user's id everywhere. Create the user_settings row with defaults on first sign-in.
3. Add a web app manifest and icons so the site installs to a phone home screen, with light and dark theme colours.
4. Write DEPLOY.md with the exact steps to deploy to Vercel, including which environment variables to set.
```

**Check:** follow `DEPLOY.md` yourself. Sign in on your phone, add the site to your home screen, and read the lesson there. A different email address is refused. Commit.

## Step 5b. The re-reading view

**Goal:** a learned lesson can be read again in full, including a quoted text or rival views.

```
Read docs/BUILD_SPEC.md section 11 (Lesson, Map) and docs/LESSON_FORMAT.md.

On /topic/[id], once the topic is learned or recalled, show the lesson for re-reading below the state: the excerpt if the pack has one (keep its line breaks, show work, author and year), the explanation with its visual, analogy and takeaways, the positions if present as one block per view, the worked example, the misconception, the connections (each linking to its topic), the deep dive collapsed by default, and the go-further list.

In the lesson player, if the pack has an excerpt, show it as its own card straight after the guess card.

Add tests using lit04.json (excerpt) and pol06.json (positions). Change only the files this needs.
```

**Check:** with a topic marked learned, its page shows the whole lesson. Commit.

## Step 6. Review scheduler

**Goal:** the memory engine, proven by tests before it has a screen.

```
Read docs/BUILD_SPEC.md sections 7, 8 and 13.

In src/core/scheduler.ts write pure functions, no database and no Date.now():
- sessionDay(now, tz)
- pickReviewItems(pack, history) returning two recall items per section 7
- applyReview(progress, results, today) returning the new progress per the outcome table, the long-gap bonus, the lapse rule, the due date rule and the state rule
- initialSchedule(topicId, today) for a newly learned topic

If scheduler.ts already has sessionDay or initialSchedule from an earlier step, extend them and keep their tests passing.

Write the tests listed under Scheduler and Session day in section 13 first, then make them pass. Use a table of cases so each row of the outcome table is one test.
```

**Check:** `pnpm test` passes. Read the test names: every bullet under Scheduler and Session day in section 13 is there. Ask the agent which rule each test covers if any is unclear. Commit.

## Step 7. Daily deck and the Today screen

**Goal:** the app decides what you do today, and it ends.

```
Read docs/BUILD_SPEC.md sections 8, 9, 11 (Today) and 13.

1. In src/core/deck.ts write buildDeck as the pure function section 9 describes, for normal mode and the overload guard only. Return the ordered steps, the mode and the estimated minutes. Write the Deck tests from section 13 first.
2. Build the Today screen: the estimate and a Start button; then one step at a time with a thin progress bar; review steps use the question component; lesson steps use the lesson player; the last step is the end screen from section 9 point 6.
3. Record a sessions row when the deck is finished. After that, Today shows "Done for today" until the next session day.
4. Add the 15-minute short day.
5. Remove the temporary "Start lesson" button from the topic page.
6. Add three development-only helpers that refuse to run in production: a way to shift the clock, a setting DEV_IGNORE_PREREQS=1 that treats prerequisites as met so every model lesson can be opened, and a command pnpm dev:reset that deletes my own progress, history and sessions.
```

**Check:** Today offers the starter lesson if you have not done it, or a review the day after. To test tomorrow without waiting, use the clock shift, and confirm it cannot run in production. With DEV_IGNORE_PREREQS=1 the deck should offer other model lessons, never two from one field in a day. Run `pnpm dev:reset` when you finish testing. The end screen has no link to more content. Commit.

## Step 8. Settings and the error flag

**Goal:** you control the tracks, and you can report mistakes.

```
Read docs/BUILD_SPEC.md section 11 (Settings, Flag) and section 6 (unlocked).

1. Build /settings: a switch per field grouped by realm, session length, new lessons per day (0 to 3), time zone, planned break date. Switching a field off removes its topics from the deck and shows them as off on the map. Add the test from section 13: nothing is offered from a switched-off field.
2. Add a small flag control to every card and every question. It opens a note box and saves the topic, the card or item id and the note. Build /flags to list them, newest first.
```

**Check:** switch Physics off: its topics show as off on the map. Flag a card and find it on `/flags`. Commit.

## Step 9. Missed days

**Goal:** coming back after a break works.

```
Read docs/BUILD_SPEC.md sections 8, 9 (point 5), 10 and 13.

Extend src/core/deck.ts and scheduler.ts:
1. Modes: catch_up and return_check chosen from days away, with the review budgets in section 8.
2. The return check exactly as section 10: the probe queue and its order, pass and fail handling, due dates spread so no day gets more than 10 minutes, early return of new lessons, and the shorter sessions after 60 days.
3. The consolidation rule in section 9 point 5.
4. The Today screen says which mode it is in, in one plain sentence.

Write the Modes and Return check tests from section 13 first.
```

**Check:** with the dev clock, jump 5 days, then 20 days, then 70 days, and see catch-up, the return check and the short first sessions. Failing a probe never sends a topic back to new. Commit.

## Step 10. Content pipeline

**Goal:** new lessons can be written without you typing them, by any model, with research you can check. This step has three parts. Do them in order and commit after each.

Read `docs/RESEARCH_PROTOCOL.md` yourself first. It is the most important document in the kit after the build spec.

### 10a. Sources and facts

```
Read docs/RESEARCH_PROTOCOL.md (all of it) and docs/BUILD_SPEC.md section 12.

Build stages 1 to 3 of the protocol in Python under pipeline/:
- pipeline/llm.py: one function that calls a model. Provider, model name and key come from environment variables. Separate settings for the writer and the checker.
- pipeline/sources.py: read pipeline/sources/<topic_id>.txt and pipeline/source_map.json, fetch, clean to text, save under pipeline/cache/<topic_id>/ with address, tier, publisher, date, word count and hash. Enforce the source rows of the protocol's table. Add `python -m pipeline.sources --check`.
- pipeline/facts.py: split each source into pieces, ask the model for facts with exact quotations, and verify every quotation and number in code exactly as stage 2 says. Write facts.json. Then stage 3: confirmed facts and conflicts.
- Prompts live as text files under pipeline/prompts/ so I can edit them.
- Tests under pipeline/tests/ as listed in BUILD_SPEC section 13, using saved source text and a fake model. No network in tests.
- `python -m pipeline.write --dry-run <topic_id>` runs stages 1 to 3 and prints the counts for each row of the table.

Do not build drafting yet.
```

**Check:** run the dry run for `bio09` (its sources are provided). You should see at least 3 sources or a clear message saying which row failed, and 25 or more facts. Open `pipeline/cache/bio09/facts.json`, pick five facts and find each quotation in the saved source text yourself. Then run the tests and confirm that one of them feeds in a made-up quotation and sees the fact thrown away.

### 10b. Drafting, checks and the record

```
Read docs/RESEARCH_PROTOCOL.md stages 4 to 11, docs/LESSON_FORMAT.md and docs/MODEL_LESSONS.md. The files in data/lessons/ are the model lessons.

Build the rest of `python -m pipeline.write <topic_id>`:
- Stage 4 plan and stage 5 drafting in five parts, each returning its claims list.
- pipeline/visuals.py: the drawing templates named in the protocol, built on pipeline/svg_helpers.py. The model picks a template and fills parameters; code renders the svg.
- Stage 6 claim check with the checker model, with at most two redrafts per part.
- Stage 7 number check and stage 8 link check in code only.
- Stage 9: run scripts/validate_lessons.py on the result and write one PNG sheet of the drawings.
- Stage 10: pipeline/records/<topic_id>.json, including tokens used and cost for the run, and verification.notes built from it.
- A pack that fails any stage goes to pipeline/rejected/ with the reasons, never to data/lessons/.
- `python -m pipeline.audit <topic_id>` prints five random claims with their quotations and addresses.
```

**Check:** run it for `lrn02`. Read the record: the counts must meet every row of the protocol's table. Run the audit and open the five addresses. Look at the drawing sheet. Read the lesson.

### 10c. Qualify the model

```
Read the section "Qualifying a model" in docs/RESEARCH_PROTOCOL.md.

Build `python -m pipeline.qualify --model <name>`. It runs the pipeline for the thirteen topics that have hand-written lessons, writing to pipeline/qualify/<model>/ and never to data/lessons/. It then prints the report table from the protocol. For research recall, compare each entry of the hand-written lesson's sources[].supports with the new fact sheet using the checker model, and list the entries that were not covered so I can read them.
```

**Check:** run it for the model you plan to use. If it misses a pass mark, try the changes in the protocol's table for weaker models (smaller pieces, more calls, templates only) and run it again. Do not generate lessons for the site with a model that has not passed. Put two of its lessons next to the hand-written ones and read both.

## Step 11. Write the starter unit, then use it

1. Run the pipeline for `lrn02` to `lrn09`, one at a time.
2. Read each lesson fully and run `python -m pipeline.audit` on it. Fix what is wrong by hand, or flag it and rerun. Check that every card's picture shows the card's idea.
3. Set `verification.status` to `verified` only for lessons you have read. Run `pnpm import:lessons`.
4. Use the site every day for two weeks before building anything else. Flag everything that annoys you.
5. Then generate Season 1 lessons a couple of weeks ahead of where you are, and come back for release 2 (the tutor) with your flags.

## When things go wrong

| Problem | What to do |
| --- | --- |
| The agent changed many unrelated files | `git reset --hard`, start a new chat, and add "Change only the files this step needs" to the prompt |
| A test fails and the agent wants to change the test | Check the spec. If the test matches the spec, the code is wrong. Say so |
| The agent says the spec is ambiguous | It may be right. Decide the rule, write it into the spec, then continue |
| The lesson drawings look wrong in dark mode | The svg must use `currentColor` and `--accent`. Check the sanitiser did not strip them |
| A generated lesson states a fact with no source | Reject it. The claim check should have caught it, so add the case to `pipeline/tests/`. Then add a better source to `pipeline/sources/<topic_id>.txt` and rerun |
| A topic lands in `pipeline/needs_sources.txt` | Find two or three good pages yourself, put their addresses in `pipeline/sources/<topic_id>.txt`, and rerun |
| You change to a cheaper model | Run `python -m pipeline.qualify` first. The research bar does not move |
