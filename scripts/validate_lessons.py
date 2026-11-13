#!/usr/bin/env python3
"""Validate every lesson pack in data/lessons against the format and the skeleton.

Usage:  pip install jsonschema   then   python scripts/validate_lessons.py
Exits with status 1 if any lesson fails, so it can run in CI.
"""
import json, pathlib, re, sys

try:
    from jsonschema import Draft202012Validator
except ImportError:
    sys.exit("Missing dependency. Run: pip install jsonschema")

ROOT = pathlib.Path(__file__).resolve().parent.parent
schema = json.loads((ROOT / "data" / "lesson.schema.json").read_text())
skeleton = json.loads((ROOT / "data" / "skeleton.json").read_text())
topics = {t["id"]: t for t in skeleton["topics"]}
validator = Draft202012Validator(schema)

BAD_SVG = re.compile(r"<script|<foreignObject|\son\w+\s*=|href\s*=\s*[\"']https?:|<image", re.I)
SVG_TEXT = re.compile(r'<text x="([\d.]+)" y="[\d.]+" font-size="([\d.]+)" text-anchor="(\w+)"[^>]*>([^<]*)</text>')


def clipped_text(svg):
    """Rough check that each label fits inside the 320-wide drawing. Widths are
    estimated at 0.56 of the font size per character, so treat a hit as a prompt to look."""
    hits = []
    for x, size, anchor, label in SVG_TEXT.findall(svg):
        x, width = float(x), len(label) * float(size) * 0.56
        left = x if anchor == "start" else x - width if anchor == "end" else x - width / 2
        if left < -4 or left + width > 324:
            hits.append(label)
    return hits


def visuals(lesson):
    yield "explanation", lesson["explanation"]["visual"]
    for c in lesson["cards"]:
        yield c["id"], c["visual"]


def check(path):
    problems = []
    lesson = json.loads(path.read_text())
    for err in sorted(validator.iter_errors(lesson), key=lambda e: list(e.path)):
        where = "/".join(str(p) for p in err.path) or "(top level)"
        problems.append(f"format: {where}: {err.message[:160]}")
    if problems:
        return problems  # the checks below assume the shape is right

    tid = lesson["topic_id"]
    if path.stem != tid:
        problems.append(f"file name {path.name} does not match topic_id {tid}")
    topic = topics.get(tid)
    if not topic:
        return problems + [f"topic_id {tid} is not in the skeleton"]
    if lesson["title"] != topic["title"]:
        problems.append("title differs from the skeleton")
    if lesson["question"] != topic["question"]:
        problems.append("question differs from the skeleton")

    ids = [o["id"] for o in lesson["guess"]["options"]]
    if lesson["guess"]["answer_id"] not in ids:
        problems.append("guess.answer_id is not one of the options")

    for name, key in (("card", "cards"), ("recall item", "recall_items")):
        seen = [x["id"] for x in lesson[key]]
        if len(seen) != len(set(seen)):
            problems.append(f"duplicate {name} ids")
    for item in lesson["recall_items"]:
        if item["kind"] == "mcq" and item["answer"] not in [o["id"] for o in item["options"]]:
            problems.append(f"{item['id']}: answer is not one of the options")
    probe = next(i for i in lesson["recall_items"] if i["probe"])
    if not probe["first_check"]:
        problems.append("the probe item should also be a first-check item")

    for c in lesson["connections"]:
        if c["to"] not in topics:
            problems.append(f"connection to unknown topic {c['to']}")
        elif c["to"] == tid:
            problems.append("a lesson cannot connect to itself")
    skeleton_links = {l["to"] for l in topic["links"]}
    skeleton_links |= {e["a"] if e["b"] == tid else e["b"] for e in skeleton["edges"] if tid in (e["a"], e["b"])}
    missing = skeleton_links - {c["to"] for c in lesson["connections"]}
    if missing:
        problems.append(f"skeleton connections not explained in the lesson: {sorted(missing)}")

    for where, v in visuals(lesson):
        if v["kind"] == "svg" and BAD_SVG.search(v["svg"]):
            problems.append(f"{where}: svg contains script, events, external links or embedded images")
        if v["kind"] == "svg":
            for label in clipped_text(v["svg"]):
                problems.append(f"{where}: label probably runs outside the drawing: {label!r}")

    ex = lesson.get("excerpt")
    if ex:
        if ex["rights"] == "public_domain" and ex["year"] >= 1929:
            problems.append("excerpt: only works first published before 1929 may be quoted as public domain")
        if ex["rights"] == "open_licence" and not ex.get("licence"):
            problems.append("excerpt: an openly licensed excerpt must name its licence")

    if lesson["verification"]["status"] == "verified":
        tiers = {s["tier"] for s in lesson["sources"]}
        if not tiers & {"research", "textbook", "reference"}:
            problems.append("a verified lesson needs at least one research, textbook or reference source")
        if len({s["url"].split("#")[0].rstrip("/") for s in lesson["sources"]}) < 2:
            problems.append("a verified lesson needs at least two different sources")
        for g in lesson["go_further"]:
            if "url" in g and "verified_on" not in g:
                problems.append(f"go_further link not marked as checked: {g['title']}")
    return problems


def main():
    files = sorted((ROOT / "data" / "lessons").glob("*.json"))
    if not files:
        sys.exit("No lesson files found in data/lessons")
    failed = 0
    for f in files:
        problems = check(f)
        hosts = {s["url"].split("/")[2] for s in json.loads(f.read_text()).get("sources", [])}
        shared = hosts & {"pmc.ncbi.nlm.nih.gov", "arxiv.org", "doi.org", "archive.org"}  # hosts for many publishers
        if not problems and len(hosts) < 2 and not shared:
            print(f"note {f.name}: every source comes from {next(iter(hosts))}; add one from another publisher when you can")
        if problems:
            failed += 1
            print(f"FAIL {f.name}")
            for p in problems:
                print("   -", p)
        else:
            print(f"ok   {f.name}")
    print(f"{len(files) - failed} of {len(files)} lessons valid")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
