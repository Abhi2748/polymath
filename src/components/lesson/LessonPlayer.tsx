"use client";

import { useEffect, useRef, useState } from "react";
import { saveCardIndex } from "@/app/topic/[id]/lesson/actions";
import type { Card } from "@/core/lesson";
import type { SafeLessonPack } from "@/lib/safeLesson";
import { FirstCheck } from "./FirstCheck";
import { Markdown } from "./Markdown";
import { Visual } from "./Visual";

const SWIPE_PX = 50;

export function LessonPlayer({ pack, startIndex }: { pack: SafeLessonPack; startIndex: number }) {
  const cardCount = pack.cards.length;
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), cardCount));
  const [guessChoice, setGuessChoice] = useState<string | null>(null);
  const savedIndex = useRef(startIndex);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const card: Card | undefined = pack.cards[index];
  const blockedByGuess = card?.kind === "guess" && guessChoice === null;

  useEffect(() => {
    if (index === savedIndex.current) return;
    savedIndex.current = index;
    saveCardIndex(pack.topic_id, index).catch((e) => console.error("could not save card index", e));
  }, [index, pack.topic_id]);

  function go(delta: 1 | -1) {
    if (delta === 1 && blockedByGuess) return;
    const next = index + delta;
    if (next < 0 || next > cardCount) return;
    setIndex(next);
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (index >= cardCount) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full bg-accent transition-[width]" style={{ width: `${((index + 1) / (cardCount + 1)) * 100}%` }} />
      </div>

      <div className="mt-8">
        {card ? (
          <div
            className="touch-pan-y select-none"
            onPointerDown={(e) => (pointerStart.current = { x: e.clientX, y: e.clientY })}
            onPointerUp={(e) => {
              const start = pointerStart.current;
              pointerStart.current = null;
              if (!start) return;
              const dx = e.clientX - start.x;
              const dy = e.clientY - start.y;
              if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
            }}
          >
            <p className="text-sm text-muted">
              {index + 1} of {cardCount}
            </p>
            <div className="mt-4">
              <Visual visual={card.visual} />
            </div>
            <h2 className="mt-6 text-2xl font-semibold">{card.title}</h2>
            <div className="mt-3 text-lg leading-relaxed">
              <Markdown>{card.body_md}</Markdown>
            </div>
            {card.kind === "guess" && <Guess pack={pack} choice={guessChoice} onChoose={setGuessChoice} />}

            <nav className="mt-10 flex gap-3">
              <button
                type="button"
                className="rounded-xl border border-line px-5 py-3 disabled:opacity-40"
                disabled={index === 0}
                onClick={() => go(-1)}
              >
                Back
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-accent px-5 py-3 font-medium text-background disabled:opacity-40"
                disabled={blockedByGuess}
                onClick={() => go(1)}
              >
                {index === cardCount - 1 ? "Check what stuck" : "Next"}
              </button>
            </nav>
          </div>
        ) : (
          <FirstCheck pack={pack} />
        )}
      </div>
    </div>
  );
}

function Guess({
  pack,
  choice,
  onChoose,
}: {
  pack: SafeLessonPack;
  choice: string | null;
  onChoose: (id: string) => void;
}) {
  const { options, answer_id, reveal } = pack.guess;
  return (
    <div className="mt-6">
      <ul className="space-y-3">
        {options.map((o) => {
          const marker =
            choice && o.id === answer_id
              ? "border-accent text-accent"
              : choice && o.id === choice
                ? "border-foreground line-through"
                : "border-line";
          return (
            <li key={o.id}>
              <button
                type="button"
                className={`w-full rounded-xl border px-4 py-3 text-left ${marker}`}
                disabled={choice !== null}
                onClick={() => onChoose(o.id)}
              >
                {o.text}
              </button>
            </li>
          );
        })}
      </ul>
      {choice && (
        <div className="mt-6" aria-live="polite">
          <p className="text-lg font-medium">{choice === answer_id ? "You guessed right." : "Not this time."}</p>
          <p className="mt-1 text-lg leading-relaxed">{reveal}</p>
        </div>
      )}
    </div>
  );
}
