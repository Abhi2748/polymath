import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { StateLabel } from "@/components/StateLabel";
import { CURRENT_USER_ID } from "@/db/currentUser";
import { getTopic } from "@/db/queries";
import { startLesson } from "./lesson/actions";

export default function TopicPage({ params }: PageProps<"/topic/[id]">) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <Link href="/map" className="text-sm text-muted">
        ← Map
      </Link>
      <Suspense fallback={<p className="mt-8 text-muted">Loading…</p>}>
        <Topic params={params} />
      </Suspense>
    </main>
  );
}

async function Topic({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const topic = await getTopic(CURRENT_USER_ID, id);
  if (!topic) notFound();

  return (
    <article className="mt-8">
      <p className="text-sm text-muted">{topic.fieldName}</p>
      <h1 className="mt-1 text-3xl font-semibold">{topic.title}</h1>
      <p className="mt-6 text-xl leading-relaxed">{topic.question}</p>
      <p className="mt-6">
        <StateLabel state={topic.state} />
      </p>

      {/* Temporary: the Today screen replaces this button in step 7. */}
      {(topic.state === "ready" || topic.state === "in_progress") && (
        <form action={startLesson.bind(null, topic.id)} className="mt-8">
          <button type="submit" className="w-full rounded-xl bg-accent px-5 py-3 font-medium text-background">
            {topic.state === "ready" ? "Start lesson" : "Resume lesson"}
          </button>
        </form>
      )}

      {topic.prereqs.length > 0 && (
        <section className="mt-12" aria-labelledby="prereqs">
          <h2 id="prereqs" className="text-lg font-medium text-muted">
            Comes after
          </h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {topic.prereqs.map((p) => (
              <li key={p.id}>
                <Link href={`/topic/${p.id}`} className="flex items-baseline justify-between gap-4 py-3">
                  <span>{p.title}</span>
                  <StateLabel state={p.state} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
