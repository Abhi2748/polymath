"use client";

import { useState } from "react";
import { type Grade, gradeResponse, type Response, type SelfGrade } from "@/core/grading";
import type { RecallItem } from "@/core/lesson";

const button = "w-full rounded-xl border px-4 py-3 text-left";
const primary = "w-full rounded-xl bg-accent px-4 py-3 font-medium text-background disabled:opacity-40";

const selfGrades: { grade: SelfGrade; label: string }[] = [
  { grade: "forgot", label: "Forgot" },
  { grade: "partly", label: "Partly" },
  { grade: "got_it", label: "Got it" },
];

// Use a fresh key per question so its state resets.
export function Question({ item, onDone }: { item: RecallItem; onDone: (response: Response) => void }) {
  return (
    <div>
      <p className="text-xl leading-relaxed">{item.prompt}</p>
      <div className="mt-6">
        {item.grading === "self" ? <SelfGraded item={item} onDone={onDone} /> : <AutoGraded item={item} onDone={onDone} />}
      </div>
    </div>
  );
}

function AutoGraded({ item, onDone }: { item: RecallItem; onDone: (response: Response) => void }) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState<{ response: Response; grade: Grade } | null>(null);

  function submit(v: string) {
    const response: Response = { kind: "auto", value: v };
    setSubmitted({ response, grade: gradeResponse(item, response) });
  }

  const choices =
    item.kind === "mcq"
      ? (item.options ?? [])
      : item.kind === "true_false"
        ? [
            { id: "true", text: "True" },
            { id: "false", text: "False" },
          ]
        : null;
  const chosen = submitted?.response.kind === "auto" ? submitted.response.value : null;

  return (
    <div>
      {choices ? (
        <ul className="space-y-3">
          {choices.map((c) => {
            const marker =
              submitted && c.id === item.answer
                ? "border-accent text-accent"
                : submitted && c.id === chosen
                  ? "border-foreground line-through"
                  : "border-line";
            return (
              <li key={c.id}>
                <button type="button" className={`${button} ${marker}`} disabled={!!submitted} onClick={() => submit(c.id)}>
                  {c.text}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) submit(value);
          }}
        >
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!!submitted}
            autoComplete="off"
            autoCapitalize="off"
            aria-label="Your answer"
            className="w-full rounded-xl border border-line bg-transparent px-4 py-3 text-lg"
          />
          {!submitted && (
            <button type="submit" className={`${primary} mt-4`} disabled={!value.trim()}>
              Check
            </button>
          )}
        </form>
      )}

      {submitted && (
        <div className="mt-6" aria-live="polite">
          <p className="text-lg font-medium">{submitted.grade === "correct" ? "Right." : "Not quite."}</p>
          {submitted.grade !== "correct" && !choices && <p className="mt-1">Answer: {item.answer}</p>}
          {item.explanation && <p className="mt-2 text-muted">{item.explanation}</p>}
          <button type="button" className={`${primary} mt-6`} onClick={() => onDone(submitted.response)}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

function SelfGraded({ item, onDone }: { item: RecallItem; onDone: (response: Response) => void }) {
  const [shown, setShown] = useState(false);

  return (
    <div>
      <textarea
        rows={3}
        aria-label="Your answer, for yourself"
        placeholder="Answer in your head or write it here"
        className="w-full rounded-xl border border-line bg-transparent px-4 py-3 text-lg"
        readOnly={shown}
      />
      {!shown ? (
        <button type="button" className={`${primary} mt-4`} onClick={() => setShown(true)}>
          Show answer
        </button>
      ) : (
        <div className="mt-6" aria-live="polite">
          <p className="text-sm text-muted">Answer</p>
          <p className="mt-1 text-lg">{item.answer}</p>
          {item.explanation && <p className="mt-2 text-muted">{item.explanation}</p>}
          <p className="mt-6 text-sm text-muted">How did you do?</p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {selfGrades.map((g) => (
              <button
                key={g.grade}
                type="button"
                className="rounded-xl border border-line px-3 py-3 font-medium"
                onClick={() => onDone({ kind: "self", grade: g.grade })}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
