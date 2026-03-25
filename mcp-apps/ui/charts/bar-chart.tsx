import * as React from "react";

var VW = 500;

function truncLabel(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

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

function rPath(x: number, y: number, w: number, h: number, r: number, side: string): string {
  if (w <= 0 || Math.abs(h) < 0.5) return "";
  r = Math.min(r, w / 2, Math.abs(h) / 2);
  if (r < 0.5) return "M" + x + " " + y + "h" + w + "v" + h + "h" + (-w) + "Z";
  if (side === "top") {
    return "M" + x + " " + (y + h) + "V" + (y + r) +
      "Q" + x + " " + y + " " + (x + r) + " " + y +
      "H" + (x + w - r) +
      "Q" + (x + w) + " " + y + " " + (x + w) + " " + (y + r) +
      "V" + (y + h) + "Z";
  }
  if (side === "right") {
    return "M" + x + " " + y +
      "H" + (x + w - r) +
      "Q" + (x + w) + " " + y + " " + (x + w) + " " + (y + r) +
      "V" + (y + h - r) +
      "Q" + (x + w) + " " + (y + h) + " " + (x + w - r) + " " + (y + h) +
      "H" + x + "Z";
  }
  if (side === "bottom") {
    return "M" + x + " " + y + "H" + (x + w) +
      "V" + (y + h - r) +
      "Q" + (x + w) + " " + (y + h) + " " + (x + w - r) + " " + (y + h) +
      "H" + (x + r) +
      "Q" + x + " " + (y + h) + " " + x + " " + (y + h - r) + "Z";
  }
  return "M" + x + " " + y + "h" + w + "v" + h + "h" + (-w) + "Z";
}

/* ── Types ───────────────────────────────────────────── */

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

export interface BarSeries {
  key: string;
  color: string;
}

export interface BarChartProps {
  data: any[];
  height?: number;
  maxValue?: number;
  showLabels?: boolean;
  horizontal?: boolean;
  className?: string;
  referenceLine?: { value: number; label?: string; color?: string };
  rotateLabels?: boolean;
  labelWidth?: number;
  series?: BarSeries[];
  defaultColor?: string;
}

/* ── Component ───────────────────────────────────────── */

export function BarChart(props: BarChartProps) {
  var data = props.data || [];
  if (data.length === 0) return null;

  var horizontal = props.horizontal || false;
  var showLabels = props.showLabels !== false;
  var series = props.series;
  var r = 3;
  var defColor = props.defaultColor || "var(--color-primary, #3b82f6)";
  var txt = "var(--color-muted-foreground, #94a3b8)";
  var grid = "var(--color-border, #334155)";
  var fg = "var(--color-foreground, #e2e8f0)";

  /* ── Stacked horizontal bars ─────────────────────── */
  if (series && series.length > 0 && horizontal) {
    var slw = props.labelWidth || 80;
    var sBarH = 18;
    var sGap = 8;
    var sP = { t: 8, r: 20, b: 22, l: slw };
    var sVH = sP.t + data.length * (sBarH + sGap) + sP.b;
    var sAreaW = VW - sP.l - sP.r;
    var sTotals = data.map(function (d) {
      var sum = 0;
      for (var si = 0; si < series!.length; si++) sum += Number(d[series![si].key]) || 0;
      return sum;
    });
    var sMax = props.maxValue || Math.max.apply(null, sTotals) || 1;
    var sTicks = getTicks(0, sMax, 4);

    return (
      <div className={props.className} style={{ width: "100%" }}>
        <svg viewBox={"0 0 " + VW + " " + sVH} style={{ width: "100%", display: "block" }}>
          {sTicks.map(function (t) {
            var tx = sP.l + (t / sMax) * sAreaW;
            return (
              <g key={"st" + t}>
                <line x1={tx} y1={sP.t} x2={tx} y2={sVH - sP.b} stroke={grid} strokeWidth="0.5" strokeDasharray="3 3" />
                <text x={tx} y={sVH - sP.b + 14} textAnchor="middle" fill={txt} fontSize="10">{fmtTick(t)}</text>
              </g>
            );
          })}
          {data.map(function (d, i) {
            var by = sP.t + i * (sBarH + sGap);
            var segs: React.JSX.Element[] = [];
            var cx = sP.l;
            for (var si = 0; si < series!.length; si++) {
              var sv = Number(d[series![si].key]) || 0;
              var sw = (sv / sMax) * sAreaW;
              var isLast = si === series!.length - 1;
              segs.push(
                <path key={series![si].key} d={rPath(cx, by, sw, sBarH, isLast ? r : 0, isLast ? "right" : "")} fill={series![si].color} fillOpacity="0.85">
                  <title>{series![si].key + ": " + sv}</title>
                </path>
              );
              cx += sw;
            }
            return (
              <g key={"sb" + i}>
                {showLabels && (
                  <text x={sP.l - 6} y={by + sBarH / 2 + 4} textAnchor="end" fill={fg} fontSize="11">
                    {truncLabel(String(d.label || d.name || ""), Math.floor(slw / 7))}
                  </text>
                )}
                {segs}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  /* ── Simple bars ─────────────────────────────────── */
  var sd = data as BarDatum[];
  var vals = sd.map(function (d) { return d.value; });
  var minV = Math.min(0, Math.min.apply(null, vals));
  var maxV = props.maxValue || Math.max.apply(null, vals);
  if (maxV <= minV) maxV = minV + 1;
  var range = maxV - minV;

  /* ── Simple horizontal ───────────────────────────── */
  if (horizontal) {
    var lw = props.labelWidth || 80;
    var barH = 18;
    var gap = 8;
    var hP = { t: 8, r: 20, b: 22, l: lw };
    var hVH = hP.t + sd.length * (barH + gap) + hP.b;
    var hAreaW = VW - hP.l - hP.r;
    var zeroX = hP.l + ((0 - minV) / range) * hAreaW;
    var hTicks = getTicks(Math.max(0, minV), maxV, 4);

    return (
      <div className={props.className} style={{ width: "100%" }}>
        <svg viewBox={"0 0 " + VW + " " + hVH} style={{ width: "100%", display: "block" }}>
          {hTicks.map(function (t) {
            var tx = hP.l + ((t - minV) / range) * hAreaW;
            return (
              <g key={"ht" + t}>
                <line x1={tx} y1={hP.t} x2={tx} y2={hVH - hP.b} stroke={grid} strokeWidth="0.5" strokeDasharray="3 3" />
                <text x={tx} y={hVH - hP.b + 14} textAnchor="middle" fill={txt} fontSize="10">{fmtTick(t)}</text>
              </g>
            );
          })}
          {sd.map(function (d, i) {
            var by = hP.t + i * (barH + gap);
            var bx = d.value >= 0 ? zeroX : zeroX - (Math.abs(d.value) / range) * hAreaW;
            var bw = (Math.abs(d.value) / range) * hAreaW;
            return (
              <g key={"hb" + i}>
                {showLabels && (
                  <text x={hP.l - 6} y={by + barH / 2 + 4} textAnchor="end" fill={fg} fontSize="11">
                    {truncLabel(d.label, Math.floor(lw / 7))}
                  </text>
                )}
                <path d={rPath(bx, by, bw, barH, r, "right")} fill={d.color || defColor} fillOpacity="0.85">
                  <title>{d.label + ": " + d.value}</title>
                </path>
              </g>
            );
          })}
          {props.referenceLine && (function () {
            var rlx = hP.l + ((props.referenceLine!.value - minV) / range) * hAreaW;
            var rlc = props.referenceLine!.color || txt;
            return (
              <g>
                <line x1={rlx} y1={hP.t - 4} x2={rlx} y2={hVH - hP.b} stroke={rlc} strokeWidth="1.5" strokeDasharray="4 4" />
                {props.referenceLine!.label && (
                  <text x={rlx} y={hP.t - 8} textAnchor="middle" fill={rlc} fontSize="9">{props.referenceLine!.label}</text>
                )}
              </g>
            );
          })()}
        </svg>
      </div>
    );
  }

  /* ── Simple vertical ─────────────────────────────── */
  var rot = props.rotateLabels || false;
  var vP = { t: 15, r: 15, b: rot ? 65 : 40, l: 45 };
  var vVH = 280;
  var vAreaH = vVH - vP.t - vP.b;
  var vAreaW = VW - vP.l - vP.r;
  var barW = Math.min(35, (vAreaW / sd.length) * 0.7);
  var barGap = (vAreaW - barW * sd.length) / (sd.length + 1);
  var baseY = vP.t + (maxV / range) * vAreaH;
  var vTicks = getTicks(minV, maxV, 5);

  return (
    <div className={props.className} style={{ width: "100%", height: props.height || undefined }}>
      <svg viewBox={"0 0 " + VW + " " + vVH} style={{ width: "100%", display: "block" }}>
        {vTicks.map(function (t) {
          var ty = vP.t + ((maxV - t) / range) * vAreaH;
          return (
            <g key={"vt" + t}>
              <line x1={vP.l} y1={ty} x2={VW - vP.r} y2={ty} stroke={grid} strokeWidth="0.5" strokeDasharray="3 3" />
              <text x={vP.l - 6} y={ty + 3.5} textAnchor="end" fill={txt} fontSize="10">{fmtTick(t)}</text>
            </g>
          );
        })}
        {minV < 0 && (
          <line x1={vP.l} y1={baseY} x2={VW - vP.r} y2={baseY} stroke={grid} strokeWidth="1" />
        )}
        {sd.map(function (d, i) {
          var bx = vP.l + barGap + i * (barW + barGap);
          var bh = (Math.abs(d.value) / range) * vAreaH;
          var by = d.value >= 0 ? baseY - bh : baseY;
          var lx = bx + barW / 2;
          var ly = vVH - vP.b + (rot ? 8 : 14);
          return (
            <g key={"vb" + i}>
              <path d={rPath(bx, by, barW, bh, r, d.value >= 0 ? "top" : "bottom")} fill={d.color || defColor} fillOpacity="0.85">
                <title>{d.label + ": " + d.value}</title>
              </path>
              {showLabels && (
                <text
                  x={lx} y={ly}
                  textAnchor={rot ? "end" : "middle"}
                  fill={txt}
                  fontSize="10"
                  transform={rot ? "rotate(-35 " + lx + " " + ly + ")" : undefined}
                >
                  {truncLabel(d.label, rot ? 14 : 10)}
                </text>
              )}
            </g>
          );
        })}
        {props.referenceLine && (function () {
          var rly = vP.t + ((maxV - props.referenceLine!.value) / range) * vAreaH;
          var rlc = props.referenceLine!.color || txt;
          return (
            <g>
              <line x1={vP.l} y1={rly} x2={VW - vP.r} y2={rly} stroke={rlc} strokeWidth="1.5" strokeDasharray="4 4" />
              {props.referenceLine!.label && (
                <text x={VW - vP.r + 2} y={rly - 4} textAnchor="start" fill={rlc} fontSize="9">{props.referenceLine!.label}</text>
              )}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
