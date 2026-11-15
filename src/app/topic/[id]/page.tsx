import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LessonReread } from "@/components/lesson/LessonReread";
import { StateLabel } from "@/components/StateLabel";
import { getLessonPack } from "@/db/lessonProgress";
import { getTopic, getTopicTitles } from "@/db/queries";
import { requireUserId } from "@/lib/auth";
import { safeLessonPack } from "@/lib/safeLesson";

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
  const topic = await getTopic(await requireUserId(), id);
  if (!topic) notFound();

  const learned = topic.state === "learned" || topic.state === "recalled";
  const pack = learned ? await getLessonPack(topic.id) : null;
  const connectionTitles = pack ? await getTopicTitles(pack.connections.map((c) => c.to)) : {};

  return (
    <article className="mt-8">
      <p className="text-sm text-muted">{topic.fieldName}</p>
      <h1 className="mt-1 text-3xl font-semibold">{topic.title}</h1>
      <p className="mt-6 text-xl leading-relaxed">{topic.question}</p>
      <p className="mt-6">
        <StateLabel state={topic.state} />
      </p>

      {pack && <LessonReread pack={safeLessonPack(pack)} connectionTitles={connectionTitles} />}

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
