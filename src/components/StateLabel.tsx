import { type MapState, mapStateLabel } from "@/core/state";

const tone: Record<MapState, string> = {
  ready: "text-accent font-medium",
  in_progress: "text-accent",
  learned: "text-foreground",
  recalled: "text-foreground",
  locked: "text-muted",
  not_written: "text-muted",
  off: "text-muted",
};

export function StateLabel({ state }: { state: MapState }) {
  return <span className={`shrink-0 text-sm ${tone[state]}`}>{mapStateLabel[state]}</span>;
}
