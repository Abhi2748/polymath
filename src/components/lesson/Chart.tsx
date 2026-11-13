"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import type { Visual } from "@/core/lesson";

type ChartSpec = Extract<Visual, { kind: "chart" }>["chart"];

const seriesColours = [
  "var(--accent)",
  "var(--foreground)",
  "var(--muted)",
  "color-mix(in srgb, var(--accent) 50%, var(--muted))",
];
const scatterShapes = ["circle", "square", "triangle", "diamond"] as const;

const tick = { fill: "var(--muted)", fontSize: 12 };
const axisLine = { stroke: "var(--line)" };
const labelStyle = { fill: "var(--foreground)", fontSize: 13 };

// One row per x value, with each series' y under s0, s1, ...
function mergedRows(spec: ChartSpec) {
  const rows = new Map<string, Record<string, string | number>>();
  spec.series.forEach((s, i) => {
    for (const [x, y] of s.points) {
      const key = String(x);
      const row = rows.get(key) ?? { x: key };
      row[`s${i}`] = y;
      rows.set(key, row);
    }
  });
  return [...rows.values()];
}

export function Chart({ spec }: { spec: ChartSpec }) {
  const numericX = spec.series.every((s) => s.points.every(([x]) => typeof x === "number"));
  const margin = { top: 8, right: 12, bottom: 24, left: 8 };

  const xAxis = (
    <XAxis
      dataKey="x"
      type={numericX && spec.type !== "bar" ? "number" : "category"}
      allowDuplicatedCategory={false}
      tick={tick}
      axisLine={axisLine}
      tickLine={axisLine}
      label={{ value: spec.x_label, position: "insideBottom", offset: -16, style: labelStyle }}
    />
  );
  const yAxis = (
    <YAxis
      type="number"
      dataKey={spec.type === "scatter" ? "y" : undefined}
      tick={tick}
      axisLine={axisLine}
      tickLine={axisLine}
      width={52}
      label={{ value: spec.y_label, angle: -90, position: "insideLeft", offset: 4, style: { ...labelStyle, textAnchor: "middle" } }}
    />
  );
  const grid = <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />;
  const legend = (
    <Legend
      verticalAlign="top"
      height={32}
      formatter={(value) => <span style={{ color: "var(--foreground)", fontSize: 13 }}>{value}</span>}
    />
  );

  let chart;
  if (spec.type === "scatter") {
    chart = (
      <ScatterChart margin={margin}>
        {grid}
        {xAxis}
        {yAxis}
        {legend}
        {spec.series.map((s, i) => (
          <Scatter
            key={s.name}
            name={s.name}
            data={s.points.map(([x, y]) => ({ x, y }))}
            fill={seriesColours[i]}
            shape={scatterShapes[i]}
            legendType={scatterShapes[i]}
            isAnimationActive={false}
          />
        ))}
      </ScatterChart>
    );
  } else if (spec.type === "line") {
    chart = (
      <LineChart data={mergedRows(spec).map((r) => (numericX ? { ...r, x: Number(r.x) } : r))} margin={margin}>
        {grid}
        {xAxis}
        {yAxis}
        {legend}
        {spec.series.map((s, i) => (
          <Line
            key={s.name}
            name={s.name}
            dataKey={`s${i}`}
            stroke={seriesColours[i]}
            strokeWidth={2.5}
            dot={{ r: 3, fill: seriesColours[i] }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    );
  } else {
    chart = (
      <BarChart data={mergedRows(spec)} margin={margin}>
        {grid}
        {xAxis}
        {yAxis}
        {legend}
        {spec.series.map((s, i) => (
          <Bar key={s.name} name={s.name} dataKey={`s${i}`} fill={seriesColours[i]} isAnimationActive={false} />
        ))}
      </BarChart>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      {chart}
    </ResponsiveContainer>
  );
}
