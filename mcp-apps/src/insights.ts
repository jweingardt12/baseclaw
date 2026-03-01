/**
 * AI Recommendation Engine
 *
 * Each function analyzes tool response data and produces a context-aware
 * recommendation string for display in the AI Insight component.
 */

import type {
  LineupOptimizeResponse,
  MatchupStrategyResponse,
  WaiverAnalyzeResponse,
  InjuryReportResponse,
  CategoryCheckResponse,
  StandingsResponse,
  StreamingResponse,
  TradeEvalResponse,
  WhatsNewResponse,
  DraftRecommendResponse,
  TradeFinderResponse,
  CloserMonitorResponse,
  ScoutOpponentResponse,
  RankingsResponse,
  CompareResponse,
  IntelPlayerReportResponse,
  BreakoutsResponse,
  SeasonPaceResponse,
  PowerRankingsResponse,
  WeekPlannerResponse,
  PitcherMatchupResponse,
  DailyUpdateResponse,
  CategorySimulateResponse,
  ILStashAdvisorResponse,
  OptimalMovesResponse,
  PlayoffPlannerResponse,
  RivalHistoryOverviewResponse,
  RivalHistoryDetailResponse,
  AchievementsResponse,
  WeeklyNarrativeResponse,
} from "./api/types.js";

export function generateLineupInsight(data: LineupOptimizeResponse): string | null {
  if (data.applied) return "Lineup optimized! All swaps applied successfully.";
  var offDay = data.active_off_day || [];
  var bench = data.bench_playing || [];
  var swaps = data.suggested_swaps || [];
  if (offDay.length === 0 && bench.length === 0) return "Your lineup is fully optimized for today. No changes needed.";
  var parts: string[] = [];
  if (offDay.length > 0 && bench.length > 0) {
    parts.push(offDay.length + " starter" + (offDay.length === 1 ? "" : "s") + " sitting idle while " + bench.length + " bench bat" + (bench.length === 1 ? "" : "s") + " ha" + (bench.length === 1 ? "s" : "ve") + " games.");
  }
  if (swaps.length > 0) {
    var first = swaps[0];
    parts.push("Start " + first.bench_player + " at " + first.position + " (replacing " + first.start_player + ").");
    if (swaps.length > 1) parts.push((swaps.length - 1) + " more swap" + (swaps.length - 1 === 1 ? "" : "s") + " available.");
  }
  return parts.join(" ") || null;
}

export function generateMatchupInsight(data: MatchupStrategyResponse): string | null {
  var score = data.score;
  var cats = data.categories || [];
  var result = score.wins > score.losses ? "Leading" : score.wins < score.losses ? "Trailing" : "Tied";
  var close = cats.filter(function (c) { return c.margin === "close"; });
  var targets = (data.strategy && data.strategy.target) || [];
  var parts: string[] = [];
  parts.push(result + " " + score.wins + "-" + score.losses + (score.ties > 0 ? "-" + score.ties : "") + " vs " + data.opponent + ".");
  if (close.length > 0) {
    var flippable = close.filter(function (c) { return c.result === "loss"; }).map(function (c) { return c.name; });
    if (flippable.length > 0) {
      parts.push(flippable.join(" and ") + " " + (flippable.length === 1 ? "is" : "are") + " your best flip target" + (flippable.length === 1 ? "" : "s") + ".");
    }
  }
  if (targets.length > 0) parts.push("Target: " + targets.slice(0, 3).join(", ") + ".");
  return parts.join(" ") || null;
}

export function generateWaiverInsight(data: WaiverAnalyzeResponse): string | null {
  var recs = data.recommendations || [];
  var weak = data.weak_categories || [];
  if (recs.length === 0) return "No high-impact waiver targets found right now.";
  var top = recs[0];
  var parts: string[] = [];
  parts.push("Top target: " + top.name + " (" + top.pct + "% owned).");
  if (weak.length > 0) {
    parts.push("Directly addresses your weakest categories: " + weak.slice(0, 2).map(function (c) { return c.name; }).join(" and ") + ".");
  }
  if (recs.length > 1) parts.push((recs.length - 1) + " more option" + (recs.length - 1 === 1 ? "" : "s") + " available.");
  return parts.join(" ");
}

export function generateInjuryInsight(data: InjuryReportResponse): string | null {
  var active = data.injured_active || [];
  var healthy = data.healthy_il || [];
  if (active.length === 0 && healthy.length === 0) return "Roster is healthy. No IL moves needed.";
  var parts: string[] = [];
  if (active.length > 0) {
    parts.push(active.length + " injured player" + (active.length === 1 ? "" : "s") + " in your active lineup need" + (active.length === 1 ? "s" : "") + " attention.");
    var first = active[0];
    parts.push("Move " + first.name + " to IL.");
  }
  if (healthy.length > 0) {
    parts.push(healthy.length + " player" + (healthy.length === 1 ? "" : "s") + " on IL with no injury status \u2014 may be activatable.");
    parts.push("Activate " + healthy[0].name + " to free an IL slot.");
  }
  return parts.join(" ");
}

export function generateCategoryInsight(data: CategoryCheckResponse): string | null {
  var weakest = data.weakest || [];
  var strongest = data.strongest || [];
  if (weakest.length === 0 && strongest.length === 0) return "Category balance looks good across the board.";
  var parts: string[] = [];
  if (weakest.length > 0) {
    var weakCats = (data.categories || []).filter(function (c) { return weakest.includes(c.name); });
    var details = weakCats.slice(0, 2).map(function (c) { return c.name + " (" + c.rank + "/" + c.total + ")"; });
    parts.push("Weakest: " + details.join(", ") + ".");
    parts.push("Target these on waivers or trades.");
  }
  if (strongest.length > 0) parts.push("Dominant in " + strongest.slice(0, 2).join(", ") + " \u2014 potential trade chips.");
  return parts.join(" ");
}

export function generateStandingsInsight(data: StandingsResponse): string | null {
  var standings = data.standings || [];
  if (standings.length === 0) return null;
  var first = standings[0];
  var myTeam = standings.find(function (t) { return t.rank === 1; });
  if (standings.length < 2) return "Leading the league at " + first.wins + "-" + first.losses + ".";
  return standings.length + " teams competing. Leader: " + first.name + " (" + first.wins + "-" + first.losses + ").";
}

export function generateStreamingInsight(data: StreamingResponse): string | null {
  var recs = data.recommendations || [];
  if (recs.length === 0) return "No strong streaming options this week.";
  var top = recs[0];
  var twoStart = recs.filter(function (r) { return r.games >= 7; });
  var parts: string[] = [];
  parts.push("Lead with " + top.name + " (" + top.team + ", " + top.pct + "% owned).");
  if (twoStart.length > 0) parts.push(twoStart.length + " two-start pitcher" + (twoStart.length === 1 ? "" : "s") + " available.");
  return parts.join(" ");
}

export function generateTradeInsight(data: TradeEvalResponse): string | null {
  var parts: string[] = [];
  parts.push("Grade: " + data.grade + ".");
  parts.push("Net value: " + (data.net_value >= 0 ? "+" : "") + data.net_value.toFixed(1) + " z-score.");
  var losing = (data.position_impact && data.position_impact.losing) || [];
  var gaining = (data.position_impact && data.position_impact.gaining) || [];
  if (losing.length > 0) parts.push("You lose depth at " + losing.join(", ") + ".");
  if (gaining.length > 0) parts.push("You gain at " + gaining.join(", ") + ".");
  return parts.join(" ");
}

export function generateWhatsNewInsight(data: WhatsNewResponse): string | null {
  var priorities: string[] = [];
  var injuries = data.injuries || [];
  var trades = data.pending_trades || [];
  var trending = data.trending || [];
  var prospects = data.prospects || [];
  var priority = 1;
  if (injuries.length > 0) {
    priorities.push("Priority " + priority + ": Handle " + injuries.length + " injur" + (injuries.length === 1 ? "y" : "ies") + " on your roster.");
    priority++;
  }
  if (trades.length > 0) {
    priorities.push("Priority " + priority + ": Review " + trades.length + " pending trade" + (trades.length === 1 ? "" : "s") + ".");
    priority++;
  }
  if (trending.length > 0) {
    var top = trending[0];
    priorities.push("Priority " + priority + ": Consider " + top.name + " (" + top.percent_owned + "% owned, " + top.delta + ").");
  }
  if (prospects.length > 0 && priorities.length < 3) {
    priorities.push(prospects.length + " prospect call-up" + (prospects.length === 1 ? "" : "s") + " to monitor.");
  }
  return priorities.length > 0 ? priorities.join(" ") : "No urgent items. Your roster is in good shape.";
}

export function generateDraftInsight(data: DraftRecommendResponse): string | null {
  var parts: string[] = [];
  parts.push(data.recommendation);
  if (data.top_pick) {
    parts.push("Top pick: " + data.top_pick.name + " (" + data.top_pick.type + (data.top_pick.z_score != null ? ", z-score " + data.top_pick.z_score.toFixed(1) : "") + ").");
  }
  return parts.join(" ");
}

export function generateTradeFinderInsight(data: TradeFinderResponse): string | null {
  // Target-player mode
  if (data.target_player) {
    var proposals = data.proposals || [];
    if (proposals.length === 0) return "No viable trade packages found for " + data.target_player + ".";
    var parts: string[] = [];
    parts.push(data.target_player + " is on " + (data.target_team || "?") + " (Z=" + (data.target_z_score || "?") + ", " + (data.target_tier || "?") + ").");
    var best_prop = proposals[0];
    parts.push("Best package: " + best_prop.summary + " (fairness " + best_prop.fairness_score + ").");
    if (best_prop.addresses_needs && best_prop.addresses_needs.length > 0) {
      parts.push("Addresses their needs in " + best_prop.addresses_needs.slice(0, 3).join(", ") + ".");
    }
    return parts.join(" ");
  }
  // League-scan mode
  var partners = data.partners || [];
  if (partners.length === 0) return "No complementary trade partners found in the league.";
  var best = partners[0];
  var scan_parts: string[] = [];
  scan_parts.push("Best match: " + best.team_name + " (complementary in " + best.complementary_categories.slice(0, 2).join(", ") + ").");
  if (best.packages && best.packages.length > 0) {
    var pkg = best.packages[0];
    var give = (pkg.give || []).map(function (p) { return p.name; }).join(", ");
    var get = (pkg.get || []).map(function (p) { return p.name; }).join(", ");
    scan_parts.push("Offer " + give + " for " + get + ".");
  }
  return scan_parts.join(" ");
}

export function generateCloserInsight(data: CloserMonitorResponse): string | null {
  var mine = data.my_closers || [];
  var available = data.available_closers || [];
  var parts: string[] = [];
  parts.push("You have " + mine.length + " closer" + (mine.length === 1 ? "" : "s") + " rostered.");
  if (available.length > 0) {
    var top = available[0];
    parts.push(top.name + " is available (" + top.percent_owned + "% owned).");
  }
  return parts.join(" ");
}

export function generateScoutInsight(data: ScoutOpponentResponse): string | null {
  var weaknesses = data.opp_weaknesses || [];
  var strategy = data.strategy || [];
  var parts: string[] = [];
  if (weaknesses.length > 0) {
    parts.push("Opponent weak in " + weaknesses.slice(0, 2).join(" and ") + ".");
  }
  if (strategy.length > 0) parts.push(strategy[0]);
  return parts.join(" ") || null;
}

export function generateRankingsInsight(data: RankingsResponse): string | null {
  var players = data.players || [];
  if (players.length === 0) return null;
  var top = players[0];
  return "Best available: " + top.name + " (z-score " + top.z_score.toFixed(1) + "). " + (data.source === "z-score" ? "Based on z-score valuations." : "Based on rankings.");
}

export function generateCompareInsight(data: CompareResponse): string | null {
  var zScores = data.z_scores || {};
  var cats = Object.keys(zScores);
  var p1Wins = 0;
  var p2Wins = 0;
  for (var i = 0; i < cats.length; i++) {
    var cat = cats[i];
    var vals = zScores[cat];
    if (vals.player1 > vals.player2) p1Wins++;
    else if (vals.player2 > vals.player1) p2Wins++;
  }
  var winner = p1Wins > p2Wins ? data.player1.name : p2Wins > p1Wins ? data.player2.name : null;
  if (winner) {
    return winner + " wins " + Math.max(p1Wins, p2Wins) + " of " + cats.length + " categories. " + (p1Wins > p2Wins ? data.player2.name : data.player1.name) + " wins " + Math.min(p1Wins, p2Wins) + ".";
  }
  return "Dead even at " + p1Wins + "-" + p2Wins + " across " + cats.length + " categories.";
}

export function generatePlayerReportInsight(data: IntelPlayerReportResponse): string | null {
  var sc = data.statcast;
  if (!sc) return null;
  var tier = sc.quality_tier || "Unknown";
  var parts: string[] = [];
  if (tier === "Elite" || tier === "Great") parts.push("BUY \u2014");
  else if (tier === "Poor") parts.push("SELL \u2014");
  else parts.push("HOLD \u2014");
  if (sc.barrel_pct_rank != null) parts.push("Barrel rate: " + sc.barrel_pct_rank + "th percentile.");
  if (sc.xwoba != null && sc.xwoba_pct_rank != null) parts.push("xwOBA: " + sc.xwoba.toFixed(3) + " (" + sc.xwoba_pct_rank + "th %ile).");
  return parts.join(" ") || null;
}

export function generateBreakoutInsight(data: BreakoutsResponse): string | null {
  var candidates = data.candidates || [];
  if (candidates.length === 0) return "No strong breakout candidates found.";
  var top = candidates[0];
  return "Top breakout: " + top.name + ". xwOBA outpacing wOBA by " + top.diff.toFixed(3) + " \u2014 positive regression incoming.";
}

export function generateSeasonPaceInsight(data: SeasonPaceResponse): string | null {
  var teams = data.teams || [];
  var myTeam = teams.find(function (t) { return t.is_my_team; });
  if (!myTeam) return null;
  var parts: string[] = [];
  parts.push("Ranked #" + myTeam.rank + " with " + myTeam.wins + "-" + myTeam.losses + " record.");
  if (myTeam.playoff_status === "IN") parts.push("Currently in playoff position.");
  else if (myTeam.playoff_status === "BUBBLE") parts.push("On the bubble \u2014 every win matters.");
  else parts.push("Outside playoff picture \u2014 need to make moves.");
  if (myTeam.magic_number > 0) parts.push("Magic number: " + myTeam.magic_number + ".");
  return parts.join(" ");
}

export function generatePowerRankInsight(data: PowerRankingsResponse): string | null {
  var rankings = data.rankings || [];
  var myTeam = rankings.find(function (t) { return t.is_my_team; });
  if (!myTeam) return null;
  var parts: string[] = [];
  parts.push("Ranked #" + myTeam.rank + " by roster strength.");
  if (myTeam.hitting_count > myTeam.pitching_count + 3) parts.push("Hitter-heavy roster \u2014 pitching depth could be a gap.");
  else if (myTeam.pitching_count > myTeam.hitting_count + 3) parts.push("Pitcher-heavy roster \u2014 batting depth could be a gap.");
  else parts.push("Well-balanced roster construction.");
  return parts.join(" ");
}

export function generateWeekPlannerInsight(data: WeekPlannerResponse): string | null {
  var totals = data.daily_totals || {};
  var dates = Object.keys(totals);
  if (dates.length === 0) return null;
  var max = 0;
  var min = Infinity;
  var maxDay = "";
  var minDay = "";
  for (var i = 0; i < dates.length; i++) {
    var d = dates[i];
    var v = totals[d];
    if (v > max) { max = v; maxDay = d; }
    if (v < min) { min = v; minDay = d; }
  }
  var parts: string[] = [];
  parts.push("Busiest day: " + maxDay.slice(5) + " (" + max + " games).");
  parts.push("Lightest: " + minDay.slice(5) + " (" + min + " games).");
  if (min <= 2) parts.push("Consider a streaming add for the light day.");
  return parts.join(" ");
}

export function generatePitcherMatchupInsight(data: PitcherMatchupResponse): string | null {
  var pitchers = data.pitchers || [];
  if (pitchers.length === 0) return null;
  var sorted = pitchers.slice().sort(function (a, b) {
    var gradeOrder: Record<string, number> = { "A+": 1, "A": 2, "B+": 3, "B": 4, "C+": 5, "C": 6, "D": 7, "F": 8 };
    return (gradeOrder[a.matchup_grade] || 9) - (gradeOrder[b.matchup_grade] || 9);
  });
  var best = sorted[0];
  var worst = sorted[sorted.length - 1];
  var parts: string[] = [];
  parts.push("Best matchup: " + best.name + " vs " + best.opponent + " (" + best.matchup_grade + ").");
  if (sorted.length > 1 && worst !== best) {
    parts.push("Worst: " + worst.name + " vs " + worst.opponent + " (" + worst.matchup_grade + ").");
  }
  var twoStart = pitchers.filter(function (p) { return p.two_start; });
  if (twoStart.length > 0) parts.push(twoStart.length + " two-start pitcher" + (twoStart.length === 1 ? "" : "s") + " this week.");
  return parts.join(" ");
}

export function generateDailyUpdateInsight(data: DailyUpdateResponse): string | null {
  var parts: string[] = [];
  var lineup = data.lineup;
  var injuries = data.injuries;
  var offDay = (lineup && lineup.active_off_day) || [];
  var injured = (injuries && injuries.injured_active) || [];
  if (offDay.length > 0) parts.push(offDay.length + " lineup issue" + (offDay.length === 1 ? "" : "s") + " to fix.");
  if (injured.length > 0) parts.push(injured.length + " injured player" + (injured.length === 1 ? "" : "s") + " in active lineup.");
  if (parts.length === 0) return "All clear! Lineup and injury status look good.";
  return parts.join(" ");
}

export function generateSimulateInsight(data: CategorySimulateResponse): string | null {
  var simRanks = data.simulated_ranks || [];
  var improved = simRanks.filter(function (r) { return r.change > 0; });
  var declined = simRanks.filter(function (r) { return r.change < 0; });
  var parts: string[] = [];
  if (improved.length > 0) parts.push("Improves " + improved.length + " categor" + (improved.length === 1 ? "y" : "ies") + ": " + improved.slice(0, 3).map(function (r) { return r.name + " (+" + r.change + ")"; }).join(", ") + ".");
  if (declined.length > 0) parts.push("Declines in " + declined.length + ": " + declined.slice(0, 2).map(function (r) { return r.name + " (" + r.change + ")"; }).join(", ") + ".");
  return parts.join(" ") || data.summary || null;
}

export function generateILStashInsight(data: ILStashAdvisorResponse): string | null {
  var slots = data.il_slots || { used: 0, total: 0 };
  var yours = data.your_il_players || [];
  var fa = data.fa_il_stash_candidates || [];
  var parts: string[] = [];
  parts.push(slots.used + "/" + slots.total + " IL slots used.");
  var stash = yours.filter(function (p) { return p.recommendation === "stash"; });
  var drop = yours.filter(function (p) { return p.recommendation === "drop"; });
  if (drop.length > 0) parts.push("Drop " + drop.map(function (p) { return p.name; }).join(", ") + " to free IL space.");
  if (stash.length > 0) parts.push("Hold " + stash.map(function (p) { return p.name; }).join(", ") + ".");
  var faStash = fa.filter(function (p) { return p.recommendation === "stash"; });
  if (faStash.length > 0) parts.push("Stash from FA: " + faStash.slice(0, 3).map(function (p) { return p.name; }).join(", ") + ".");
  if (parts.length <= 1) return data.summary || "IL roster looks good.";
  return parts.join(" ");
}

export function generateOptimalMovesInsight(data: OptimalMovesResponse): string | null {
  var moves = data.moves || [];
  if (moves.length === 0) return data.summary || "No beneficial moves found.";
  var parts: string[] = [];
  parts.push(moves.length + " move" + (moves.length === 1 ? "" : "s") + " found (+" + data.net_improvement + " total z-score).");
  var top = moves[0];
  if (top) {
    parts.push("Best: Drop " + top.drop.name + " (z=" + top.drop.z_score + ") for " + top.add.name + " (z=" + top.add.z_score + ", +" + top.z_improvement + ").");
    if (top.categories_gained.length > 0) {
      parts.push("Gains " + top.categories_gained.slice(0, 3).join(", ") + ".");
    }
  }
  return parts.join(" ");
}

export function generatePlayoffPlannerInsight(data: PlayoffPlannerResponse): string | null {
  var parts: string[] = [];
  var rank = data.current_rank;
  var cutoff = data.playoff_cutoff;
  var prob = data.playoff_probability;
  parts.push("Rank " + rank + "/" + data.num_teams + " (" + prob + "% playoff probability).");
  if (rank <= cutoff) {
    parts.push("Currently in a playoff spot.");
  } else {
    parts.push(data.games_back + " game" + (data.games_back === 1 ? "" : "s") + " back.");
  }
  var highActions = (data.recommended_actions || []).filter(function (a) { return a.priority === "high"; });
  if (highActions.length > 0) {
    parts.push(highActions.length + " high-priority action" + (highActions.length === 1 ? "" : "s") + " to take.");
  }
  var targets = data.target_categories || [];
  if (targets.length > 0) {
    parts.push("Target: " + targets.slice(0, 3).join(", ") + ".");
  }
  return parts.join(" ");
}

export function generateRivalHistoryInsight(data: RivalHistoryOverviewResponse | RivalHistoryDetailResponse): string | null {
  if ("rivals" in data) {
    var rivals = (data as RivalHistoryOverviewResponse).rivals || [];
    if (rivals.length === 0) return null;
    var best = rivals[0];
    var worst = rivals[rivals.length - 1];
    var parts: string[] = [];
    parts.push("Best record vs " + best.opponent + " (" + best.record + ").");
    if (worst.wins < worst.losses) {
      parts.push("Toughest rival: " + worst.opponent + " (" + worst.record + ").");
    }
    return parts.join(" ");
  }
  var detail = data as RivalHistoryDetailResponse;
  var dParts: string[] = [];
  dParts.push(detail.all_time_record + " all-time vs " + detail.opponent + ".");
  var edge = detail.category_edge || { you_dominate: [], they_dominate: [] };
  if (edge.you_dominate.length > 0) {
    dParts.push("You dominate: " + edge.you_dominate.slice(0, 3).join(", ") + ".");
  }
  if (edge.they_dominate.length > 0) {
    dParts.push("They dominate: " + edge.they_dominate.slice(0, 3).join(", ") + ".");
  }
  return dParts.join(" ");
}

export function generateAchievementsInsight(data: AchievementsResponse): string | null {
  var earned = data.total_earned || 0;
  var total = data.total_available || 0;
  var parts: string[] = [];
  parts.push(earned + "/" + total + " achievements earned.");
  var recent = (data.achievements || []).filter(function (a) { return a.earned; });
  if (recent.length > 0) {
    var names = recent.slice(0, 3).map(function (a) { return a.name; });
    parts.push("Unlocked: " + names.join(", ") + ".");
  }
  var next = (data.achievements || []).filter(function (a) { return !a.earned; });
  if (next.length > 0) {
    parts.push("Next up: " + next[0].name + " - " + next[0].description + ".");
  }
  return parts.join(" ");
}

export function generateWeeklyNarrativeInsight(data: WeeklyNarrativeResponse): string | null {
  var parts: string[] = [];
  var resultWord = data.result === "win" ? "Victory" : data.result === "loss" ? "Defeat" : "Draw";
  parts.push("Week " + data.week + " " + resultWord + " (" + data.score + ") vs " + data.opponent + ".");
  if (data.mvp_category && data.mvp_category.name) {
    parts.push("MVP: " + data.mvp_category.name + " (" + data.mvp_category.your_value + " vs " + data.mvp_category.opp_value + ").");
  }
  if (data.weakness && data.weakness.name) {
    parts.push("Weakness: " + data.weakness.name + ".");
  }
  if (data.standings_change && data.standings_change.direction === "up") {
    parts.push("Climbed to #" + data.standings_change.to + ".");
  } else if (data.standings_change && data.standings_change.direction === "down") {
    parts.push("Dropped to #" + data.standings_change.to + ".");
  }
  if (data.key_moves && data.key_moves.length > 0) {
    parts.push(data.key_moves.length + " roster move" + (data.key_moves.length === 1 ? "" : "s") + " this week.");
  }
  return parts.join(" ");
}
