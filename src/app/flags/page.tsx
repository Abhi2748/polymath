import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { describeFlagRef } from "@/core/flags";
import { listFlags } from "@/db/flags";
import { getUserSettings } from "@/db/userSettings";
import { requireUserId } from "@/lib/auth";

export const metadata: Metadata = { title: "Flags · Polymath" };

export default function FlagsPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <Link href="/map" className="text-sm text-muted">
        ← Map
      </Link>
      <h1 className="mt-8 text-3xl font-semibold">Flags</h1>
      <Suspense fallback={<p className="mt-8 text-muted">Loading…</p>}>
        <Flags />
      </Suspense>
    </main>
  );
}

async function Flags() {
  await connection();
  const userId = await requireUserId();
  const [flags, settings] = await Promise.all([listFlags(userId), getUserSettings(userId)]);

  if (flags.length === 0) {
    return <p className="mt-8 text-lg text-muted">Nothing flagged yet.</p>;
  }

  const date = new Intl.DateTimeFormat(undefined, { timeZone: settings.tz, day: "numeric", month: "long", year: "numeric" });

  return (
    <ol className="mt-8 divide-y divide-line border-y border-line">
      {flags.map((f) => (
        <li key={f.id} className="py-5">
          <p className="text-sm text-muted">{date.format(f.createdAt)}</p>
          <Link href={`/topic/${f.topicId}`} className="mt-1 block font-medium text-accent underline underline-offset-4">
            {f.topicTitle}
          </Link>
          <p className="mt-1 text-muted">{describeFlagRef(f.pack, f.ref)}</p>
          <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed">{f.note}</p>
        </li>
      ))}
    </ol>
  );
}
