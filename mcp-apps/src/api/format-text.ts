/** Compact text formatting helpers for workflow tools.
 *  Designed for token-efficient agent consumption. */

import { str } from "./types.js";
import type { ActionItem, RosterIssue, WaiverPair, RecordHolder } from "./types.js";

/** Append player ID suffix for agent-readable output */
export function pid(id: string | undefined | null): string {
  return id ? "  (id:" + id + ")" : "";
}

/** Format a record holder with optional context */
export function formatHolder(h: RecordHolder): string {
  return h.context ? h.team_name + " (" + h.context + ")" : h.team_name;
}

/** Append team key suffix for agent-readable output */
export function tkey(key: string | undefined | null): string {
  return key ? " (" + key + ")" : "";
}

/** Format a workflow header tag with summary stats */
export function header(tag: string, summary: string): string {
  return "[" + tag + "] " + summary;
}

/** Format priority-ranked action items */
export function actionList(items: ActionItem[]): string {
  if (!items || items.length === 0) return "ACTIONS: none";
  const lines = ["ACTIONS:"];
  for (const [i, item] of items.entries()) {
    const label = item.priority === 1 ? "CRITICAL" : item.priority === 2 ? "IMPORTANT" : "OPTIONAL";
    lines.push("  " + (i + 1) + ". " + label + ": " + item.message);
  }
  return lines.join("\n");
}

/** Format roster issues by severity */
export function issueList(issues: RosterIssue[]): string {
  if (!issues || issues.length === 0) return "No issues found.";
  const lines: string[] = [];
  for (const issue of issues) {
    const tag = issue.severity === "critical" ? "!!!" : issue.severity === "warning" ? " ! " : "   ";
    lines.push(tag + " " + issue.message + pid(issue.player_id) + " -> " + issue.fix);
  }
  return lines.join("\n");
}

/** Format waiver add/drop pairs */
export function waiverPairList(pairs: WaiverPair[]): string {
  if (!pairs || pairs.length === 0) return "No waiver recommendations.";
  const lines: string[] = [];
  for (const [i, pair] of pairs.entries()) {
    const label = pair.pos_type === "B" ? "BAT" : "PIT";
    lines.push("  " + (i + 1) + ". [" + label + "] ADD " + pair.add.name
      + " (id:" + pair.add.player_id + " " + str(pair.add.percent_owned) + "% owned"
      + " score=" + str(pair.add.score) + ")"
      + " | improves: " + pair.weak_categories.join(", "));
    if ((pair.add as any).context_line) {
      lines.push("     " + (pair.add as any).context_line);
    }
  }
  return lines.join("\n");
}

/** Agent-facing strategic footer with assessment + next steps */
export function buildFooter(assessment: string, steps: string[]): string {
  var lines = ["\n---", "ASSESSMENT: " + assessment, "NEXT STEPS:"];
  for (var s of steps) lines.push("- " + s);
  return lines.join("\n");
}

/** Compact pipe-delimited section */
export function compactSection(name: string, items: string[]): string {
  if (!items || items.length === 0) return "";
  return name + ": " + items.join(" | ");
}

/** Summarize sample size context for a batch of players.
 *  Returns a warning line if most players have low/very_low confidence, else empty string. */
export function sampleWarning(players: any[]): string {
  if (!players || players.length === 0) return "";
  var lowCount = 0;
  var total = 0;
  for (var p of players) {
    var s = p.sample;
    if (!s) continue;
    total++;
    if (s.confidence === "very_low" || s.confidence === "low") lowCount++;
  }
  if (total === 0) return "";
  var pct = Math.round((lowCount / total) * 100);
  if (pct >= 50) {
    return "\nNOTE: " + pct + "% of players have low sample sizes (" + lowCount + "/" + total + "). Stats are heavily projection-weighted early season — use Statcast quality tiers and process metrics for more reliable signals.";
  }
  return "";
}
