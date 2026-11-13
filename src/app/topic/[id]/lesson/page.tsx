import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import { CURRENT_USER_ID } from "@/db/currentUser";
import { getLessonPack, getLessonProgress } from "@/db/lessonProgress";
import { safeLessonPack } from "@/lib/safeLesson";

export default function LessonPage({ params }: PageProps<"/topic/[id]/lesson">) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6">
      <Suspense fallback={<p className="mt-8 text-muted">Loading…</p>}>
        <Lesson params={params} />
      </Suspense>
    </main>
  );
}

async function Lesson({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const [pack, progress] = await Promise.all([getLessonPack(id), getLessonProgress(CURRENT_USER_ID, id)]);
  if (!pack) notFound();
  if (progress?.state !== "in_progress") redirect(`/topic/${id}`);

  return (
    <>
      <Link href={`/topic/${id}`} className="text-sm text-muted">
        ← {pack.title}
      </Link>
      <div className="mt-4">
        <LessonPlayer pack={safeLessonPack(pack)} startIndex={progress.cardIndex} />
      </div>
    </>
  );
}
