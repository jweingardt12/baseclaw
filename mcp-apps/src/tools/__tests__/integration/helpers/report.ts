/**
 * Timing aggregator and summary printer for integration tests.
 * Each test file records results; afterAll in each file prints a per-file summary.
 */

interface TimingEntry {
  path: string;
  elapsed_ms: number;
  status: "pass" | "fail" | "skip";
  error?: string;
}

var entries: TimingEntry[] = [];

export function recordResult(path: string, elapsed_ms: number, status: "pass" | "fail" | "skip", error?: string) {
  entries.push({ path: path, elapsed_ms: elapsed_ms, status: status, error: error });
}

export function getEntries() {
  return entries.slice();
}

export function printReport(label?: string) {
  var sorted = entries.slice().sort(function (a, b) { return a.path.localeCompare(b.path); });

  console.log("\n=== " + (label || "INTEGRATION TEST REPORT") + " ===\n");

  var passCount = 0;
  var failCount = 0;
  var skipCount = 0;
  var times: number[] = [];

  for (var entry of sorted) {
    var tag = "";
    if (entry.status === "pass") {
      passCount++;
      times.push(entry.elapsed_ms);
      if (entry.elapsed_ms > 30000) {
        tag = "  [CRITICAL]";
      } else if (entry.elapsed_ms > 10000) {
        tag = "  [SLOW]";
      }
    } else if (entry.status === "fail") {
      failCount++;
      tag = "  (" + (entry.error || "unknown") + ")";
    } else {
      skipCount++;
      tag = "  (skipped)";
    }

    var statusLabel = "[" + entry.status.toUpperCase() + "]";
    var timeLabel = entry.status === "skip" ? "----ms" : entry.elapsed_ms + "ms";
    console.log("  " + statusLabel + "  " + timeLabel + "  " + entry.path + tag);
  }

  times.sort(function (a, b) { return a - b; });
  var p50 = times.length > 0 ? times[Math.floor(times.length * 0.5)] : 0;
  var p95 = times.length > 0 ? times[Math.floor(times.length * 0.95)] : 0;

  console.log(
    "\nOVERALL: " + passCount + " pass | " + failCount + " fail | " + skipCount + " skip" +
    " | p50=" + (p50 / 1000).toFixed(1) + "s | p95=" + (p95 / 1000).toFixed(1) + "s\n"
  );
}

export function resetEntries() {
  entries.length = 0;
}
