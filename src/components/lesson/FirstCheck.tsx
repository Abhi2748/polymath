"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { type FirstCheckAnswer, submitFirstCheck } from "@/app/topic/[id]/lesson/actions";
import { Flag } from "@/components/Flag";
import { type FirstCheckAttempt, firstCheckItems, firstCheckOrder } from "@/core/firstCheck";
import type { Response } from "@/core/grading";
import { formatDay } from "@/lib/formatDay";
import type { SafeLessonPack } from "@/lib/safeLesson";
import { Markdown } from "./Markdown";
import { Question } from "./Question";
import { Visual } from "./Visual";

type Phase = "asking" | "explanation" | "passed" | "failed";

const primary = "block w-full rounded-xl bg-accent px-4 py-3 text-center font-medium text-background disabled:opacity-40";

// Without onFinished, the closing button links back to the topic page.
export function FirstCheck({ pack, onFinished }: { pack: SafeLessonPack; onFinished?: () => void }) {
  const [attempt, setAttempt] = useState<FirstCheckAttempt>(1);
  const [phase, setPhase] = useState<Phase>("asking");
  const [answers, setAnswers] = useState<FirstCheckAnswer[]>([]);
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const items = firstCheckOrder(firstCheckItems(pack), attempt);
  const finish = onFinished ? (
    <button type="button" className={`${primary} mt-10`} onClick={onFinished}>
      Continue
    </button>
  ) : (
    <Link href={`/topic/${pack.topic_id}`} className={`${primary} mt-10`}>
      Done
    </Link>
  );

  function submit(all: FirstCheckAnswer[]) {
    setError(null);
    startTransition(async () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const result = await submitFirstCheck(pack.topic_id, attempt, all, tz);
        setDueAt(result.dueAt);
        setPhase(result.outcome === "retry" ? "explanation" : result.outcome);
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

  if (phase === "passed") {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Learned</h2>
        <p className="mt-4 text-lg leading-relaxed">
          You passed the check. The first review is due {dueAt ? formatDay(dueAt) : "tomorrow"}.
        </p>
        {finish}
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Not yet</h2>
        <p className="mt-4 text-lg leading-relaxed">
          This one needs another look. The lesson stays in progress and opens at these questions next session.
        </p>
        {finish}
      </div>
    );
  }

  if (phase === "explanation") {
    return (
      <div>
        <p className="text-sm text-muted">Read this, then try the questions again</p>
        <div className="mt-6">
          <Visual visual={pack.explanation.visual} />
        </div>
        <div className="mt-6 text-lg leading-relaxed">
          <Markdown>{pack.explanation.body_md}</Markdown>
        </div>
        <button
          type="button"
          className={`${primary} mt-10`}
          onClick={() => {
            setAttempt(2);
            setAnswers([]);
            setPhase("asking");
            window.scrollTo(0, 0);
          }}
        >
          Try again
        </button>
      </div>
    );
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
          Check {attempt === 2 ? "again " : ""}· question {answers.length + 1} of {items.length}
        </p>
        <Flag key={`${attempt}-${current.id}`} topicId={pack.topic_id} refId={current.id} />
      </div>
      <div className="mt-6">
        <Question key={`${attempt}-${current.id}`} item={current} onDone={answer} />
      </div>
    </div>
  );
}