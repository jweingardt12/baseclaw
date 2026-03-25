import * as React from "react";

var VW = 500;
var VH = 280;

function niceNum(range: number, round: boolean): number {
  var exp = Math.floor(Math.log10(range));
  var frac = range / Math.pow(10, exp);
  var nice;
  if (round) {
    nice = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  } else {
    nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  }
  return nice * Math.pow(10, exp);
}

function getTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min];
  var range = niceNum(max - min, false);
  var step = niceNum(range / (count - 1), true);
  var lo = Math.floor(min / step) * step;
  var hi = Math.ceil(max / step) * step;
  var ticks: number[] = [];
  for (var t = lo; t <= hi + step * 0.5; t += step) {
    ticks.push(Math.round(t * 1e6) / 1e6);
  }
  return ticks;
}

function fmtTick(v: number): string {
  if (v === 0) return "0";
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100);
}

/* ── Types ───────────────────────────────────────────── */

export interface LineSeries {
  key: string;
  color: string;
}

export interface LineChartProps {
  data: Array<Record<string, any>>;
  series: LineSeries[];
  height?: number;
  className?: string;
  areaFill?: boolean;
  reversed?: boolean;
  yDomain?: [number, number];
  yLabel?: string;
  connectNulls?: boolean;
}

/* ── Component ───────────────────────────────────────── */

export function LineChart(props: LineChartProps) {
  var data = props.data || [];
  var series = props.series || [];
  if (data.length === 0 || series.length === 0) return null;

  var reversed = props.reversed || false;
  var areaFill = props.areaFill || false;
  var txt = "var(--color-muted-foreground, #94a3b8)";
  var gridC = "var(--color-border, #334155)";

  var pad = { t: 15, r: 15, b: 35, l: props.yLabel ? 60 : 50 };
  var plotW = VW - pad.l - pad.r;
  var plotH = VH - pad.t - pad.b;

  // Compute Y domain
  var allVals: number[] = [];
  for (var di = 0; di < data.length; di++) {
    for (var si = 0; si < series.length; si++) {
      var v = data[di][series[si].key];
      if (v != null && !isNaN(v)) allVals.push(v);
    }
  }

  var yMin: number, yMax: number;
  if (props.yDomain) {
    yMin = props.yDomain[0];
    yMax = props.yDomain[1];
  } else if (allVals.length > 0) {
    yMin = Math.min.apply(null, allVals);
    yMax = Math.max.apply(null, allVals);
    var yPad = (yMax - yMin) * 0.05 || 0.5;
    yMin = yMin - yPad;
    yMax = yMax + yPad;
  } else {
    yMin = 0;
    yMax = 1;
  }
  var yRange = yMax - yMin || 1;

  function toX(i: number): number {
    if (data.length <= 1) return pad.l + plotW / 2;
    return pad.l + (i / (data.length - 1)) * plotW;
  }

  function toY(val: number): number {
    var ratio = (val - yMin) / yRange;
    return reversed ? pad.t + ratio * plotH : pad.t + (1 - ratio) * plotH;
  }

  var ticks = getTicks(yMin, yMax, 5);

  // X-axis label skip logic
  var xSkip = data.length > 12 ? Math.ceil(data.length / 8) : 1;

  return (
    <div className={props.className} style={{ width: "100%", height: props.height || undefined }}>
      <svg viewBox={"0 0 " + VW + " " + VH} style={{ width: "100%", display: "block" }}>
        {/* Grid lines */}
        {ticks.map(function (t) {
          var ty = toY(t);
          return (
            <g key={"gt" + t}>
              <line x1={pad.l} y1={ty} x2={VW - pad.r} y2={ty} stroke={gridC} strokeWidth="0.5" strokeDasharray="3 3" />
              <text x={pad.l - 6} y={ty + 3.5} textAnchor="end" fill={txt} fontSize="10">{fmtTick(t)}</text>
            </g>
          );
        })}

        {/* Y-axis label */}
        {props.yLabel && (
          <text x={14} y={pad.t + plotH / 2} textAnchor="middle" fill={txt} fontSize="10" transform={"rotate(-90 14 " + (pad.t + plotH / 2) + ")"}>
            {props.yLabel}
          </text>
        )}

        {/* X-axis labels */}
        {data.map(function (d, i) {
          if (i % xSkip !== 0 && i !== data.length - 1) return null;
          var lx = toX(i);
          var label = String(d.label || "");
          return (
            <text key={"xl" + i} x={lx} y={VH - pad.b + 16} textAnchor="middle" fill={txt} fontSize="10">
              {label.length > 8 ? label.slice(0, 7) + "\u2026" : label}
            </text>
          );
        })}

        {/* Series */}
        {series.map(function (s) {
          var pts: Array<[number, number]> = [];
          for (var pi = 0; pi < data.length; pi++) {
            var val = data[pi][s.key];
            if (val == null || isNaN(val)) continue;
            pts.push([toX(pi), toY(val)]);
          }
          if (pts.length === 0) return null;

          var polyStr = pts.map(function (p) { return p[0] + "," + p[1]; }).join(" ");

          return (
            <g key={"s" + s.key}>
              {/* Area fill */}
              {areaFill && pts.length > 1 && (
                <polygon
                  points={polyStr + " " + pts[pts.length - 1][0] + "," + (pad.t + plotH) + " " + pts[0][0] + "," + (pad.t + plotH)}
                  fill={s.color}
                  fillOpacity="0.1"
                />
              )}
              {/* Line */}
              <polyline points={polyStr} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
              {/* Dots */}
              {pts.map(function (p, di) {
                return (
                  <circle key={"d" + di} cx={p[0]} cy={p[1]} r="3" fill={s.color}>
                    <title>{s.key + ": " + data[di] ? data[di][s.key] : ""}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
