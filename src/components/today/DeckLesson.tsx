"use client";

import { useState, useTransition } from "react";
import { finishDeckLesson } from "@/app/actions";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import type { SafeLessonPack } from "@/lib/safeLesson";

export function DeckLesson({
  pack,
  startIndex,
  cardsOnly = false,
}: {
  pack: SafeLessonPack;
  startIndex: number;
  cardsOnly?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function finish() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await finishDeckLesson(pack.topic_id);
      } catch {
        setError("Could not move on. Check the connection and try again.");
      }
    });
  }

  return (
    <>
      <LessonPlayer pack={pack} startIndex={startIndex} onFinished={finish} cardsOnly={cardsOnly} />
      {error && (
        <p className="mt-4" aria-live="polite">
          {error}
        </p>
      )}
    </>
  );
}
