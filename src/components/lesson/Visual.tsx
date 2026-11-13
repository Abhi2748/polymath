import type { Visual as VisualSpec } from "@/core/lesson";
import { Chart } from "./Chart";

// svg must already have been through safeLessonPack.
export function Visual({ visual }: { visual: VisualSpec }) {
  return (
    <figure className="text-foreground">
      {visual.kind === "svg" && (
        <div
          role="img"
          aria-label={visual.alt}
          className="aspect-[16/9] w-full [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: visual.svg }}
        />
      )}
      {visual.kind === "chart" && (
        <div role="img" aria-label={visual.alt}>
          <Chart spec={visual.chart} />
        </div>
      )}
      {visual.kind === "image" &&
        (visual.src ? (
          // eslint-disable-next-line @next/next/no-img-element -- lesson images come from arbitrary licensed hosts
          <img src={visual.src} alt={visual.alt} className="w-full rounded-lg" />
        ) : (
          <p className="text-muted">{visual.alt}</p>
        ))}
      {(visual.caption || visual.kind === "image") && (
        <figcaption className="mt-2 text-sm text-muted">
          {visual.caption}
          {visual.kind === "image" && (
            <span className="block">
              {visual.credit} · {visual.licence}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
