import { connection } from "next/server";
import { Suspense } from "react";
import { currentStep, type Deck, type Mode, nextDue, type SessionSummary } from "@/core/deck";
import { pickReviewItems, probeItem, sessionDay } from "@/core/scheduler";
import { DeckLesson } from "@/components/today/DeckLesson";
import { ProbeStep } from "@/components/today/ProbeStep";
import { ReviewStep } from "@/components/today/ReviewStep";
import { getLessonPack, getLessonProgress } from "@/db/lessonProgress";
import { getTopicTitles } from "@/db/queries";
import { getTopicHistory, loadToday, type SessionRow } from "@/db/session";
import { requireUserId } from "@/lib/auth";
import { appNow } from "@/lib/dev";
import { formatDay } from "@/lib/formatDay";
import { safeLessonPack } from "@/lib/safeLesson";
import { openDeckLesson, startSession } from "./actions";

const primary = "block w-full rounded-xl bg-accent px-5 py-3 text-center font-medium text-background";

const modeSentence: Record<Mode, string> = {
  normal: "A normal day: reviews first, then anything new.",
  catch_up: "Catch-up: reviews take half the session, and new lessons wait until what is due fits in ten minutes.",
  return_check: "Return check: a short question on each thing you have learned.",
};

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6">
      <Suspense fallback={<p className="mt-8 text-muted">Loading…</p>}>
        <Today />
      </Suspense>
    </main>
  );
}

async function Today() {
  await connection();
  const userId = await requireUserId();
  const now = appNow();
  const today = await loadToday(userId, now, (tz) => sessionDay(now, tz));
  const next = nextDue(today.progress, today.day);

  if (today.completed) return <EndScreen summary={today.completed.summary} next={next} />;
  if (today.active) return <ActiveSession userId={userId} session={today.active} next={next} />;
  return <Ready full={today.deck("full")} short={today.deck("short")} next={next} welcome={today.welcomeBack} />;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function NextDue({ next }: { next: { day: string; count: number } | null }) {
  if (!next) return <p className="mt-4 text-lg text-muted">No reviews are scheduled yet.</p>;
  return (
    <p className="mt-4 text-lg text-muted">
      Next: {plural(next.count, "review", "reviews")} on {formatDay(next.day)}.
    </p>
  );
}

function Ready({
  full,
  short,
  next,
  welcome,
}: {
  full: Deck;
  short: Deck;
  next: { day: string; count: number } | null;
  welcome: boolean;
}) {
  const reviews = full.steps.filter((s) => s.kind === "review").length;
  const probes = full.steps.filter((s) => s.kind === "probe").length;
  const lessons = full.steps.filter((s) => s.kind === "lesson").length;
  const shortReviews = short.steps.filter((s) => s.kind === "review").length;
  const heading = welcome ? "Welcome back" : "Today";

  if (reviews + probes + lessons === 0) {
    return (
      <section className="mt-10">
        <h1 className="text-3xl font-semibold">{welcome ? "Welcome back" : "Nothing today"}</h1>
        <p className="mt-6 text-lg leading-relaxed">There is nothing due and nothing new to start.</p>
        <NextDue next={next} />
      </section>
    );
  }

  const parts = [
    probes > 0 && plural(probes, "check", "checks"),
    reviews > 0 && plural(reviews, "review", "reviews"),
    lessons > 0 && plural(lessons, "lesson", "lessons"),
  ].filter(Boolean);

  return (
    <section className="mt-10">
      <h1 className="text-3xl font-semibold">{heading}</h1>
      <p className="mt-6 text-lg leading-relaxed">{modeSentence[full.mode]}</p>
      <p className="mt-8 text-4xl font-semibold">About {full.minutes} min</p>
      <p className="mt-2 text-lg text-muted">{parts.join(" and ")}</p>
      <form action={startSession.bind(null, "full")} className="mt-10">
        <button type="submit" className={primary}>
          Start
        </button>
      </form>
      {shortReviews > 0 && (
        <form action={startSession.bind(null, "short")} className="mt-6 text-center">
          <button type="submit" className="text-muted underline underline-offset-4">
            15-minute short day
          </button>
        </form>
      )}
    </section>
  );
}

async function ActiveSession({
  userId,
  session,
  next,
}: {
  userId: string;
  session: SessionRow;
  next: { day: string; count: number } | null;
}) {
  const step = currentStep(session.summary);
  const total = session.summary.steps.length - 1;

  return (
    <div>
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full bg-accent transition-[width]" style={{ width: `${(session.summary.done / total) * 100}%` }} />
      </div>
      <p className="sr-only">
        Step {Math.min(session.summary.done + 1, total)} of {total}
      </p>
      <div className="mt-6">
        {step.kind === "end" ? (
          <EndScreen summary={session.summary} next={next} />
        ) : step.kind === "probe" ? (
          <Probe topicId={step.topicId} />
        ) : step.kind === "review" ? (
          <Review userId={userId} topicId={step.topicId} />
        ) : step.refresher ? (
          <Refresher topicId={step.topicId} />
        ) : (
          <Lesson userId={userId} topicId={step.topicId} />
        )}
      </div>
    </div>
  );
}

async function Probe({ topicId }: { topicId: string }) {
  const pack = await getLessonPack(topicId);
  if (!pack) throw new Error(`no lesson pack for ${topicId}`);
  return <ProbeStep key={topicId} topicId={topicId} title={pack.title} item={probeItem(pack)} />;
}

async function Refresher({ topicId }: { topicId: string }) {
  const pack = await getLessonPack(topicId);
  if (!pack) throw new Error(`no lesson pack for ${topicId}`);
  return (
    <div>
      <p className="text-sm text-muted">Refresher · {pack.title}</p>
      <div className="mt-6">
        <DeckLesson pack={safeLessonPack(pack)} startIndex={0} cardsOnly />
      </div>
    </div>
  );
}

async function Review({ userId, topicId }: { userId: string; topicId: string }) {
  const [pack, history] = await Promise.all([getLessonPack(topicId), getTopicHistory(userId, topicId)]);
  if (!pack) throw new Error(`no lesson pack for ${topicId}`);
  return <ReviewStep key={topicId} topicId={topicId} title={pack.title} items={pickReviewItems(pack, history)} />;
}

async function Lesson({ userId, topicId }: { userId: string; topicId: string }) {
  const [pack, progress] = await Promise.all([getLessonPack(topicId), getLessonProgress(userId, topicId)]);
  if (!pack) throw new Error(`no lesson pack for ${topicId}`);

  if (progress?.state !== "in_progress") {
    const learned = progress?.state === "learned" || progress?.state === "recalled";
    return (
      <section>
        <p className="text-sm text-muted">New lesson · about {pack.est_minutes} min</p>
        <h1 className="mt-2 text-3xl font-semibold">{pack.title}</h1>
        <p className="mt-6 text-xl leading-relaxed">{pack.question}</p>
        <form action={openDeckLesson.bind(null, topicId)} className="mt-10">
          <button type="submit" className={primary}>
            {learned ? "Continue" : "Begin"}
          </button>
        </form>
      </section>
    );
  }

  return <DeckLesson key={topicId} pack={safeLessonPack(pack)} startIndex={progress.cardIndex} />;
}

async function EndScreen({ summary, next }: { summary: SessionSummary; next: { day: string; count: number } | null }) {
  const titles = await getTopicTitles(summary.lessons.map((l) => l.topicId));
  const learned = summary.lessons.filter((l) => l.outcome === "passed").map((l) => titles[l.topicId]);
  const stillOpen = summary.lessons.filter((l) => l.outcome === "failed").map((l) => titles[l.topicId]);
  const bothRight = summary.reviews.filter((r) => r.correct === 2).length;
  const checks = summary.probes ?? [];

  return (
    <section className="mt-10">
      <h1 className="text-3xl font-semibold">Done for today</h1>
      <div className="mt-6 space-y-3 text-lg leading-relaxed">
        {checks.length > 0 && <p>You checked {plural(checks.length, "topic", "topics")}.</p>}
        {summary.reviews.length > 0 && (
          <p>
            You reviewed {plural(summary.reviews.length, "topic", "topics")}, {bothRight} with both answers right.
          </p>
        )}
        {learned.length > 0 && <p>You learned {joinTitles(learned)}.</p>}
        {stillOpen.length > 0 && <p>{joinTitles(stillOpen)} will open at the check next session.</p>}
      </div>
      <NextDue next={next} />
    </section>
  );
}

function joinTitles(titles: string[]) {
  if (titles.length <= 1) return titles.join("");
  return `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;
}
