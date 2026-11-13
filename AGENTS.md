# Polymath: instructions for coding agents

Polymath is a personal learning site that replaces a social feed. It teaches every major field from zero through short lessons, spaced review and practice. It is built for one user first.

## Read before writing code

- `docs/BUILD_SPEC.md` is the source of truth for release 1. Follow it exactly. If it is unclear or seems wrong, stop and ask. Do not guess and do not edit it yourself.
- `docs/LESSON_FORMAT.md` and `data/lesson.schema.json` define lesson packs. The files in `data/lessons/` are hand-written model lessons, described in `docs/MODEL_LESSONS.md`.
- `docs/PRODUCT.md` explains why the product is shaped this way.

## Rules

- Build only what the current step asks for. Section 1 of the spec lists what is not in release 1. Do not build those things or add hooks for them.
- All scheduling, deck and state logic goes in `src/core/` as pure functions. They take the current time as an argument and never read the clock or the database.
- Write the tests named in section 13 of the spec before the code they cover. Never change a test to make it pass unless the spec says the test is wrong.
- Every learner table carries `user_id`.
- Never edit files under `data/` by hand. Lessons come from the pipeline and must pass `scripts/validate_lessons.py`.
- Lesson text and drawings come from files and must be treated as untrusted input: sanitise svg, render Markdown safely.
- No streaks, badges, notifications, infinite lists or autoplay. Every session ends on the end screen.
- Phone first. One thing on screen at a time. Light and dark themes. One accent colour, exposed as `--accent`.
- Keep secrets in `.env.local`, never in code or commits.
- Change only the files the task needs, and say which files you changed and how to check the result.
