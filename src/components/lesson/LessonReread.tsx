import Link from "next/link";
import type { ReactNode } from "react";
import type { SafeLessonPack } from "@/lib/safeLesson";
import { Excerpt } from "./Excerpt";
import { Markdown } from "./Markdown";
import { Visual } from "./Visual";

function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-12" aria-labelledby={id}>
      <h2 id={id} className="text-2xl font-semibold">
        {title}
      </h2>
      <div className="mt-4 text-lg leading-relaxed">{children}</div>
    </section>
  );
}

export function LessonReread({
  pack,
  connectionTitles,
}: {
  pack: SafeLessonPack;
  connectionTitles: Record<string, string>;
}) {
  const { excerpt, explanation, positions, deep_dive } = pack;

  return (
    <div>
      {excerpt && (
        <Part id="excerpt" title={excerpt.work}>
          <Excerpt excerpt={excerpt} />
        </Part>
      )}

      <Part id="explanation" title="Explanation">
        <Visual visual={explanation.visual} />
        <div className="mt-6">
          <Markdown>{explanation.body_md}</Markdown>
        </div>
        <p className="mt-6 border-l-2 border-accent pl-4">{explanation.analogy}</p>
        <ul className="mt-6 list-disc space-y-2 pl-6">
          {explanation.takeaways.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Part>

      {positions && (
        <Part id="positions" title="Positions">
          <div className="space-y-6">
            {positions.map((p) => (
              <article key={p.name} className="rounded-xl border border-line p-4">
                <h3 className="text-xl font-semibold">{p.name}</h3>
                <p className="mt-2">{p.claim}</p>
                <p className="mt-3">
                  <span className="text-muted">Best argument: </span>
                  {p.best_argument}
                </p>
                <p className="mt-3">
                  <span className="text-muted">Main objection: </span>
                  {p.main_objection}
                </p>
              </article>
            ))}
          </div>
        </Part>
      )}

      <Part id="worked-example" title="Worked example">
        <Markdown>{pack.worked_example.body_md}</Markdown>
      </Part>

      <Part id="misconception" title="Common mistake">
        <p>
          <span className="text-muted">The mistake: </span>
          {pack.misconception.claim}
        </p>
        <div className="mt-4">
          <Markdown>{pack.misconception.correction_md}</Markdown>
        </div>
      </Part>

      {pack.connections.length > 0 && (
        <Part id="connections" title="Connections">
          <ul className="space-y-6">
            {pack.connections.map((c) => (
              <li key={c.to}>
                <Link href={`/topic/${c.to}`} className="font-medium text-accent underline">
                  {connectionTitles[c.to] ?? c.to}
                </Link>
                <div className="mt-1">
                  <Markdown>{c.body_md}</Markdown>
                </div>
              </li>
            ))}
          </ul>
        </Part>
      )}

      <section className="mt-12" aria-labelledby="deep-dive">
        <details>
          <summary id="deep-dive" className="cursor-pointer text-2xl font-semibold">
            Deep dive <span className="text-base font-normal text-muted">· {deep_dive.est_minutes} min</span>
          </summary>
          <div className="mt-4 text-lg leading-relaxed">
            <Markdown>{deep_dive.body_md}</Markdown>
          </div>
        </details>
      </section>

      <Part id="go-further" title="Go further">
        <ul className="space-y-4">
          {pack.go_further.map((g) => (
            <li key={g.title}>
              {g.url ? (
                <a href={g.url} className="font-medium text-accent underline" target="_blank" rel="noopener noreferrer">
                  {g.title}
                </a>
              ) : (
                <span className="font-medium">{g.title}</span>
              )}
              <span className="text-muted">
                {" "}
                · {g.kind}
                {g.by && `, ${g.by}`}
                {g.year && `, ${g.year}`}
              </span>
              <p className="mt-1">{g.note}</p>
            </li>
          ))}
        </ul>
      </Part>
    </div>
  );
}
