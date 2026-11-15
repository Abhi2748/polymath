"use client";

import { useState, useTransition } from "react";
import { type ReviewAnswer, submitReview } from "@/app/actions";
import type { Response } from "@/core/grading";
import type { RecallItem } from "@/core/lesson";
import { Flag } from "@/components/Flag";
import { Question } from "@/components/lesson/Question";

const primary = "block w-full rounded-xl bg-accent px-4 py-3 text-center font-medium text-background disabled:opacity-40";

// Use a fresh key per review so its state resets.
export function ReviewStep({ topicId, title, items }: { topicId: string; title: string; items: RecallItem[] }) {
  const [answers, setAnswers] = useState<ReviewAnswer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(all: ReviewAnswer[]) {
    setError(null);
    startTransition(async () => {
      try {
        await submitReview(topicId, all);
      } catch {
        setError("Your answers could not be saved. Check the connection and try again.");
      }
    });
  }

  function answer(response: Response) {
    const all = [...answers, { itemId: items[answers.length].id, response }];
    setAnswers(all);
    if (all.length === items.length) submit(all);
  }

  if (answers.length === items.length) {
    return (
      <div aria-live="polite">
        {pending && <p className="text-muted">Saving…</p>}
        {error && (
          <>
            <p>{error}</p>
            <button type="button" className={`${primary} mt-6`} onClick={() => submit(answers)}>
              Try again
            </button>
          </>
        )}
      </div>
    );
  }

  const current = items[answers.length];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-muted">
          Review · {title} · question {answers.length + 1} of {items.length}
        </p>
        <Flag key={current.id} topicId={topicId} refId={current.id} />
      </div>
      <div className="mt-6">
        <Question key={current.id} item={current} onDone={answer} />
      </div>
    </div>
  );
}
