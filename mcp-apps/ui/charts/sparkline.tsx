import * as React from "react";

/* ── Types ───────────────────────────────────────────── */

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

/* ── Component ───────────────────────────────────────── */

export function Sparkline(props: SparklineProps) {
  var data = props.data || [];
  if (data.length < 2) return null;

  var w = props.width || 100;
  var h = props.height || 30;
  var color = props.color || "var(--color-primary, #3b82f6)";
  var pad = 2;

  var min = Math.min.apply(null, data);
  var max = Math.max.apply(null, data);
  var range = max - min || 1;

  var points = data.map(function (v, i) {
    var x = pad + (i / (data.length - 1)) * (w - pad * 2);
    var y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return x + "," + y;
  }).join(" ");

  return (
    <svg
      viewBox={"0 0 " + w + " " + h}
      className={props.className}
      style={{ width: w + "px", height: h + "px" }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
