"use client";

import { useState, useTransition } from "react";
import { addFlag } from "@/app/flags/actions";
import { FLAG_NOTE_MAX, flagNote } from "@/core/flags";

type Phase = "closed" | "open" | "saved";

// Use a fresh key per card or question so its state resets.
// Pointer events stop here so that typing or selecting in the note never swipes the card away.
export function Flag({ topicId, refId }: { topicId: string; refId: string }) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await addFlag(topicId, refId, note);
        setPhase("saved");
        setNote("");
      } catch {
        setError("The flag could not be saved. Check the connection and try again.");
      }
    });
  }

  return (
    <div onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      {phase === "closed" && (
        <button type="button" className="text-sm text-muted underline underline-offset-4" onClick={() => setPhase("open")}>
          Flag
        </button>
      )}
      {phase === "saved" && (
        <p className="text-sm text-muted" aria-live="polite">
          Flagged
        </p>
      )}
      {phase === "open" && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-background px-5 pb-6 pt-4">
          <div className="mx-auto w-full max-w-xl">
            <label className="block">
              <span className="text-lg">What is wrong here?</span>
              <textarea
                rows={4}
                autoFocus
                maxLength={FLAG_NOTE_MAX}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-2 w-full select-text rounded-xl border border-line bg-transparent px-4 py-3 text-lg"
              />
            </label>
            {error && (
              <p className="mt-2" aria-live="polite">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                className="rounded-xl border border-line px-5 py-3"
                onClick={() => {
                  setPhase("closed");
                  setError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-accent px-5 py-3 font-medium text-background disabled:opacity-40"
                disabled={pending || !flagNote(note)}
                onClick={save}
              >
                {pending ? "Saving…" : "Save flag"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
