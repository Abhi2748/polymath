# Polymath starter kit

Everything needed to start building release 1 with Cursor or any coding agent.

| File | What it is |
| --- | --- |
| `docs/CURSOR_GUIDE.md` | Start here. Eleven steps, each with a prompt to paste and checks to run |
| `docs/BUILD_SPEC.md` | The rules release 1 must follow |
| `docs/LESSON_FORMAT.md` | How a lesson is stored |
| `docs/RESEARCH_PROTOCOL.md` | How much research every lesson gets, and how code checks it whichever model writes |
| `docs/PRODUCT.md` | What the product is and why |
| `AGENTS.md` | Standing instructions the coding agent reads automatically |
| `data/skeleton.json` | The curriculum: 24 fields, 391 topics, 337 connections |
| `data/lesson.schema.json` | The exact lesson format |
| `data/lessons/` | Thirteen hand-written model lessons, starting with The forgetting curve |
| `docs/MODEL_LESSONS.md` | What each model lesson demonstrates and which to imitate |
| `scripts/validate_lessons.py` | Checks every lesson against the format and the curriculum |
| `pipeline/source_map.json` | Approved places to look for sources, by field |
| `pipeline/sources/` | The addresses each model lesson was written from, for testing a model |
| `pipeline/svg_helpers.py` | The drawing helpers the model lessons were made with |

## First five minutes

1. Copy this folder's contents into a new, empty project folder.
2. Run `pip install jsonschema` and then `python scripts/validate_lessons.py`. It should print `ok` for every lesson.
3. Open `docs/CURSOR_GUIDE.md` and begin at Step 0.
