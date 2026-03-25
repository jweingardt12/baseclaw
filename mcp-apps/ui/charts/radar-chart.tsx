import * as React from "react";

/* ── Types ───────────────────────────────────────────── */

export interface RadarDatum {
  label: string;
  value: number;
  maxValue?: number;
}

export interface RadarOverlay {
  data: Array<{ label: string; value: number }>;
  color?: string;
  name?: string;
}

export interface RadarChartProps {
  data: RadarDatum[];
  size?: number;
  overlays?: RadarOverlay[];
  className?: string;
  fillColor?: string;
  strokeColor?: string;
  gridRings?: number;
}

/* ── Component ───────────────────────────────────────── */

export function RadarChart(props: RadarChartProps) {
  var data = props.data || [];
  if (data.length < 3) return null;

  var size = props.size || 300;
  var cx = size / 2;
  var cy = size / 2;
  var radius = size / 2 - 40;
  var rings = props.gridRings || 4;
  var n = data.length;
  var txt = "var(--color-muted-foreground, #94a3b8)";
  var gridC = "var(--color-border, #334155)";
  var primary = props.strokeColor || "var(--color-primary, #3b82f6)";
  var fill = props.fillColor || primary;

  // Collect all values (primary + overlays) for global range
  var allVals = data.map(function (d) { return d.value; });
  if (props.overlays) {
    for (var oi = 0; oi < props.overlays.length; oi++) {
      var od = props.overlays[oi].data || [];
      for (var ovi = 0; ovi < od.length; ovi++) {
        allVals.push(od[ovi].value);
      }
    }
  }
  var gMin = Math.min.apply(null, allVals);
  var gMax = Math.max.apply(null, allVals);

  function angleFor(i: number): number {
    return (2 * Math.PI * i) / n - Math.PI / 2;
  }

  function ratio(value: number, axisMax: number | undefined): number {
    if (axisMax != null && axisMax > 0) {
      return Math.max(0, Math.min(1, value / axisMax));
    }
    if (gMin >= 0) {
      return gMax > 0 ? Math.max(0, Math.min(1, value / gMax)) : 0;
    }
    var range = gMax - gMin || 1;
    return Math.max(0, Math.min(1, (value - gMin) / range));
  }

  function ptAt(i: number, val: number, axisMax: number | undefined): [number, number] {
    var a = angleFor(i);
    var r = ratio(val, axisMax) * radius;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  function buildPoly(dataset: Array<{ label: string; value: number }>): string {
    var pts: string[] = [];
    for (var i = 0; i < dataset.length && i < n; i++) {
      var axMax = data[i] ? data[i].maxValue : undefined;
      var pt = ptAt(i, dataset[i].value, axMax);
      pts.push(pt[0] + "," + pt[1]);
    }
    return pts.join(" ");
  }

  // Grid rings
  var ringEls: React.JSX.Element[] = [];
  for (var ri = 1; ri <= rings; ri++) {
    var frac = ri / rings;
    var rPts: string[] = [];
    for (var gi = 0; gi < n; gi++) {
      var a = angleFor(gi);
      rPts.push((cx + radius * frac * Math.cos(a)) + "," + (cy + radius * frac * Math.sin(a)));
    }
    ringEls.push(
      <polygon key={"ring" + ri} points={rPts.join(" ")} fill="none" stroke={gridC} strokeWidth="0.5" strokeOpacity="0.5" />
    );
  }

  // Axis lines + labels
  var axisEls: React.JSX.Element[] = [];
  for (var ai = 0; ai < n; ai++) {
    var ep = ptAt(ai, data[ai].maxValue || gMax, data[ai].maxValue);
    // Use full radius endpoint for axis line regardless of value
    var aAngle = angleFor(ai);
    var ax2 = cx + radius * Math.cos(aAngle);
    var ay2 = cy + radius * Math.sin(aAngle);
    axisEls.push(
      <line key={"ax" + ai} x1={cx} y1={cy} x2={ax2} y2={ay2} stroke={gridC} strokeWidth="0.5" strokeOpacity="0.5" />
    );
    // Label
    var lDist = radius + 16;
    var lx = cx + lDist * Math.cos(aAngle);
    var ly = cy + lDist * Math.sin(aAngle);
    var anchor = Math.abs(Math.cos(aAngle)) < 0.15 ? "middle" : Math.cos(aAngle) > 0 ? "start" : "end";
    axisEls.push(
      <text key={"lbl" + ai} x={lx} y={ly + 4} textAnchor={anchor} fill={txt} fontSize="11">
        {data[ai].label}
      </text>
    );
  }

  // Primary polygon
  var mainPoly = buildPoly(data);

  // Primary dots
  var mainDots = data.map(function (d, i) {
    var pt = ptAt(i, d.value, d.maxValue);
    return <circle key={"md" + i} cx={pt[0]} cy={pt[1]} r="3" fill={primary} />;
  });

  // Overlay polygons
  var overlayEls: React.JSX.Element[] = [];
  if (props.overlays) {
    for (var oii = 0; oii < props.overlays.length; oii++) {
      var ov = props.overlays[oii];
      var oColor = ov.color || "#ef4444";
      var oPoly = buildPoly(ov.data);
      var oDots = (ov.data || []).map(function (od2, odi) {
        var oMax = data[odi] ? data[odi].maxValue : undefined;
        var op = ptAt(odi, od2.value, oMax);
        return <circle key={"od" + odi} cx={op[0]} cy={op[1]} r="3" fill={oColor} />;
      });
      overlayEls.push(
        <g key={"ov" + oii}>
          <polygon points={oPoly} fill={oColor} fillOpacity="0.15" stroke={oColor} strokeWidth="2" />
          {oDots}
        </g>
      );
    }
  }

  return (
    <div className={props.className} style={{ width: "100%", maxWidth: size + "px", margin: "0 auto" }}>
      <svg viewBox={"0 0 " + size + " " + size} style={{ width: "100%", display: "block" }}>
        {ringEls}
        {axisEls}
        <polygon points={mainPoly} fill={fill} fillOpacity="0.2" stroke={primary} strokeWidth="2" />
        {mainDots}
        {overlayEls}
      </svg>
    </div>
  );
}
