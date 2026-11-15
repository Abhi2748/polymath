"use client";

import { useState, useTransition } from "react";
import { type ReviewAnswer, submitProbe } from "@/app/actions";
import type { Response } from "@/core/grading";
import type { RecallItem } from "@/core/lesson";
import { Flag } from "@/components/Flag";
import { Question } from "@/components/lesson/Question";

const primary = "block w-full rounded-xl bg-accent px-4 py-3 text-center font-medium text-background disabled:opacity-40";

export function ProbeStep({ topicId, title, item }: { topicId: string; title: string; item: RecallItem }) {
  const [answer, setAnswer] = useState<ReviewAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(given: ReviewAnswer) {
    setError(null);
    startTransition(async () => {
      try {
        await submitProbe(topicId, given);
      } catch {
        setError("Your answer could not be saved. Check the connection and try again.");
      }
    });
  }

  function choose(response: Response) {
    const given = { itemId: item.id, response };
    setAnswer(given);
    submit(given);
  }

  if (answer) {
    return (
      <div aria-live="polite">
        {pending && <p className="text-muted">Saving…</p>}
        {error && (
          <>
            <p>{error}</p>
            <button type="button" className={`${primary} mt-6`} onClick={() => submit(answer)}>
              Try again
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-muted">Return check · {title}</p>
        <Flag topicId={topicId} refId={item.id} />
      </div>
      <div className="mt-6">
        <Question item={item} onDone={choose} />
      </div>
    </div>
  );
}
