import type { LessonPack } from "@/core/lesson";

export function Excerpt({ excerpt }: { excerpt: NonNullable<LessonPack["excerpt"]> }) {
  return (
    <figure>
      <blockquote className="whitespace-pre-line border-l-2 border-accent pl-4 text-lg leading-relaxed">
        {excerpt.text}
      </blockquote>
      <figcaption className="mt-4 text-sm text-muted">
        <cite className="not-italic">{excerpt.work}</cite> · {excerpt.author}, {excerpt.year}
        {excerpt.rights === "open_licence" && excerpt.licence && <> · {excerpt.licence}</>} ·{" "}
        <a href={excerpt.source_url} className="underline" target="_blank" rel="noopener noreferrer">
          Source
        </a>
      </figcaption>
      {excerpt.note && <p className="mt-4 text-muted">{excerpt.note}</p>}
    </figure>
  );
}
