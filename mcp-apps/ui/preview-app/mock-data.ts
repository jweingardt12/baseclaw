// Mock data for the preview app.
// All numbers are internally consistent for a 12-team H2H category league
// in week 7 of the 2026 season. 20 scoring categories (10 batting, 10 pitching).
// Batting: R, H, HR, RBI, K (neg), TB, AVG, OBP, XBH, NSB
// Pitching: IP, W, L (neg), ER (neg), K, HLD, ERA, WHIP, QS, NSV
// "Home Run Heroes" = user's team (team 4, rank 4 after 6 weeks)

export const MOCK_DATA: Record<string, any> = {
  // ── Standings ──────────────────────────────────────────────────────────
  // Matchup record: W-L-T out of 6 completed weeks.
  // points_for = total category wins (tiebreaker), out of 120 possible (6 wks × 20 cats).
  standings: {
    standings: [
      { rank: 1, name: "Dynasty Destroyers", wins: 6, losses: 0, ties: 0, points_for: "84", team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 2, name: "The Lumber Yard", wins: 5, losses: 1, ties: 0, points_for: "77", team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 3, name: "Strikeout Kings", wins: 4, losses: 1, ties: 1, points_for: "73", team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 4, name: "Home Run Heroes", wins: 4, losses: 2, ties: 0, points_for: "71", team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 5, name: "Big Poppa Pump", wins: 3, losses: 2, ties: 1, points_for: "65", team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 6, name: "Designated Drinkers", wins: 3, losses: 3, ties: 0, points_for: "61", team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 7, name: "Caught Stealing Hearts", wins: 3, losses: 3, ties: 0, points_for: "56", team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 8, name: "Walk-Off Winners", wins: 2, losses: 4, ties: 0, points_for: "50", team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 9, name: "Error 404: Wins Not Found", wins: 2, losses: 4, ties: 0, points_for: "45", team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 10, name: "The Mendoza Liners", wins: 1, losses: 4, ties: 1, points_for: "41", team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 11, name: "Balk Street Boys", wins: 1, losses: 5, ties: 0, points_for: "37", team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 12, name: "Foul Territory", wins: 0, losses: 5, ties: 1, points_for: "28", team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
    ],
    playoff_teams: 6,
    ai_recommendation: "You're 4th, 4 points from 1st. Your pitching categories lag behind — streaming SP this week could close the gap to 3rd.",
  },

  // ── Matchups (Week 7 Scoreboard) ──────────────────────────────────────
  // Status shows running category score (team1-team2-ties out of 20 categories).
  matchups: {
    type: "scoreboard",
    week: "7",
    matchups: [
      { team1: "Home Run Heroes", team2: "Big Poppa Pump", status: "10-8-2", team1_logo: "https://placehold.co/40x40/1a1a2e/white?text=T1", team2_logo: "https://placehold.co/40x40/1a1a2e/white?text=T2" },
      { team1: "Dynasty Destroyers", team2: "Foul Territory", status: "15-4-1", team1_logo: "https://placehold.co/40x40/1a1a2e/white?text=T1", team2_logo: "https://placehold.co/40x40/1a1a2e/white?text=T2" },
      { team1: "The Lumber Yard", team2: "Balk Street Boys", status: "13-5-2", team1_logo: "https://placehold.co/40x40/1a1a2e/white?text=T1", team2_logo: "https://placehold.co/40x40/1a1a2e/white?text=T2" },
      { team1: "Strikeout Kings", team2: "Walk-Off Winners", status: "11-7-2", team1_logo: "https://placehold.co/40x40/1a1a2e/white?text=T1", team2_logo: "https://placehold.co/40x40/1a1a2e/white?text=T2" },
      { team1: "Designated Drinkers", team2: "The Mendoza Liners", status: "12-7-1", team1_logo: "https://placehold.co/40x40/1a1a2e/white?text=T1", team2_logo: "https://placehold.co/40x40/1a1a2e/white?text=T2" },
      { team1: "Caught Stealing Hearts", team2: "Error 404: Wins Not Found", status: "9-9-2", team1_logo: "https://placehold.co/40x40/1a1a2e/white?text=T1", team2_logo: "https://placehold.co/40x40/1a1a2e/white?text=T2" },
    ],
    ai_recommendation: "You're winning 10-8-2 against Big Poppa Pump. Focus on flipping HR and RBI — both within 2 of tying.",
  },

  // ── Matchup Detail (Week 7 H2H) ──────────────────────────────────────
  // 20 categories: score = { wins: 10, losses: 8, ties: 2 } = 20 total.
  // Batting K: lower is better (K_negative). Pitching K: higher is better.
  // L: lower is better (L_negative). ER: lower is better (ER_negative).
  // ERA/WHIP: lower is better. IP/W/K(pitch)/HLD/QS/NSV: higher is better.
  "matchup-detail": {
    week: 7,
    my_team: "Home Run Heroes",
    opponent: "Big Poppa Pump",
    my_team_logo: "https://placehold.co/40x40/1a1a2e/white?text=HRH",
    opp_team_logo: "https://placehold.co/40x40/1a1a2e/white?text=BPP",
    score: { wins: 10, losses: 8, ties: 2 },
    categories: [
      // ── Batting ──
      { name: "R", my_value: "38", opp_value: "28", result: "win" },
      { name: "H", my_value: "68", opp_value: "72", result: "loss" },
      { name: "HR", my_value: "12", opp_value: "9", result: "win" },
      { name: "RBI", my_value: "34", opp_value: "33", result: "win" },
      { name: "K", my_value: "52", opp_value: "48", result: "loss" },     // batting K: lower=better, I have more=loss
      { name: "TB", my_value: "118", opp_value: "125", result: "loss" },
      { name: "AVG", my_value: ".265", opp_value: ".271", result: "loss" },
      { name: "OBP", my_value: ".338", opp_value: ".332", result: "win" },
      { name: "XBH", my_value: "22", opp_value: "19", result: "win" },
      { name: "NSB", my_value: "3", opp_value: "7", result: "loss" },
      // batting subtotal: 5W, 5L, 0T

      // ── Pitching ──
      { name: "IP", my_value: "44.2", opp_value: "48.1", result: "loss" },  // more IP = better
      { name: "W", my_value: "3", opp_value: "2", result: "win" },
      { name: "L", my_value: "1", opp_value: "3", result: "win" },          // fewer L = better
      { name: "ER", my_value: "18", opp_value: "21", result: "win" },       // fewer ER = better
      { name: "K", my_value: "48", opp_value: "44", result: "win" },        // pitching K: more = better
      { name: "HLD", my_value: "2", opp_value: "2", result: "tie" },
      { name: "ERA", my_value: "3.92", opp_value: "3.65", result: "loss" }, // lower ERA = better
      { name: "WHIP", my_value: "1.18", opp_value: "1.25", result: "win" },
      { name: "QS", my_value: "3", opp_value: "3", result: "tie" },
      { name: "NSV", my_value: "1", opp_value: "2", result: "loss" },
      // pitching subtotal: 5W, 3L, 2T
      // grand total: 10W, 8L, 2T = 20 ✓
    ],
    ai_recommendation: "Winning 10-8-2. Your closest flip targets are H (4 behind) and NSV (1 behind). Stream a closer to flip NSV and grab a contact hitter for H.",
  },

  // ── Transactions ──────────────────────────────────────────────────────
  transactions: {
    trans_type: "",
    transactions: [
      { type: "add", player: "Corbin Carroll", team: "ARI", date: "2026-05-15", mlb_id: 682998, fantasy_team: "Home Run Heroes" },
      { type: "drop", player: "Tommy Edman", team: "LAD", date: "2026-05-15", mlb_id: 669023, fantasy_team: "Home Run Heroes" },
      { type: "add", player: "Logan Webb", team: "SF", date: "2026-05-15", mlb_id: 657277, fantasy_team: "Big Poppa Pump" },
      { type: "trade", player: "Juan Soto", team: "NYM", date: "2026-05-14", mlb_id: 665742, fantasy_team: "Dynasty Destroyers" },
      { type: "trade", player: "Mookie Betts", team: "LAD", date: "2026-05-14", mlb_id: 605141, fantasy_team: "Strikeout Kings" },
      { type: "drop", player: "Kenta Maeda", team: "DET", date: "2026-05-14", mlb_id: 628317, fantasy_team: "The Lumber Yard" },
      { type: "add", player: "Yainer Diaz", team: "HOU", date: "2026-05-14", mlb_id: 673237, fantasy_team: "The Lumber Yard" },
      { type: "add", player: "Josh Naylor", team: "CLE", date: "2026-05-13", mlb_id: 647304, fantasy_team: "Walk-Off Winners" },
      { type: "drop", player: "Ji-Man Choi", team: "MIA", date: "2026-05-13", mlb_id: 596847, fantasy_team: "Foul Territory" },
      { type: "add", player: "Spencer Strider", team: "ATL", date: "2026-05-13", mlb_id: 675911, fantasy_team: "Caught Stealing Hearts" },
    ],
  },

  // ── Transaction Trends ──────────────────────────────────────────────────
  "transaction-trends": {
    most_added: [
      { name: "Esteury Ruiz", player_id: "682650", team: "OAK", position: "OF,DH", percent_owned: 45, delta: "+12.3", mlb_id: 682650 },
      { name: "Colt Keith", player_id: "700363", team: "DET", position: "2B,3B", percent_owned: 55, delta: "+9.8", mlb_id: 700363 },
      { name: "Spencer Strider", player_id: "675911", team: "ATL", position: "SP", percent_owned: 88, delta: "+8.5", mlb_id: 675911 },
      { name: "Jackson Chourio", player_id: "694192", team: "MIL", position: "OF", percent_owned: 62, delta: "+7.1", mlb_id: 694192 },
      { name: "Yainer Diaz", player_id: "673237", team: "HOU", position: "C,DH", percent_owned: 62, delta: "+6.4", mlb_id: 673237 },
      { name: "Colton Cowser", player_id: "681297", team: "BAL", position: "OF", percent_owned: 48, delta: "+5.9", mlb_id: 681297 },
      { name: "Josh Naylor", player_id: "647304", team: "CLE", position: "1B,DH", percent_owned: 71, delta: "+5.2", mlb_id: 647304 },
      { name: "Bryce Miller", player_id: "682243", team: "SEA", position: "SP", percent_owned: 42, delta: "+4.8", mlb_id: 682243 },
      { name: "Dylan Crews", player_id: "700364", team: "WSH", position: "OF", percent_owned: 38, delta: "+4.3", mlb_id: 700364 },
      { name: "Bailey Ober", player_id: "641927", team: "MIN", position: "SP", percent_owned: 38, delta: "+3.9", mlb_id: 641927 },
    ],
    most_dropped: [
      { name: "Kenta Maeda", player_id: "628317", team: "DET", position: "SP", percent_owned: 12, delta: "-11.2", mlb_id: 628317 },
      { name: "Tommy Edman", player_id: "669023", team: "LAD", position: "2B,SS,OF", percent_owned: 58, delta: "-8.7", mlb_id: 669023 },
      { name: "Alex Verdugo", player_id: "657077", team: "NYY", position: "OF", percent_owned: 42, delta: "-6.5", mlb_id: 657077 },
      { name: "Ji-Man Choi", player_id: "596847", team: "MIA", position: "1B,DH", percent_owned: 8, delta: "-5.8", mlb_id: 596847 },
      { name: "Joey Gallo", player_id: "608336", team: "WSH", position: "OF,1B", percent_owned: 5, delta: "-5.1", mlb_id: 608336 },
      { name: "Andrew Benintendi", player_id: "643217", team: "CWS", position: "OF", percent_owned: 15, delta: "-4.7", mlb_id: 643217 },
      { name: "Colin Rea", player_id: "607067", team: "MIL", position: "SP", percent_owned: 18, delta: "-4.2", mlb_id: 607067 },
      { name: "Ha-Seong Kim", player_id: "673490", team: "SD", position: "SS,2B,3B", percent_owned: 55, delta: "-3.8", mlb_id: 673490 },
      { name: "Brendan Donovan", player_id: "680977", team: "STL", position: "2B,3B,OF", percent_owned: 35, delta: "-3.4", mlb_id: 680977 },
      { name: "Luis Severino", player_id: "622663", team: "NYM", position: "SP", percent_owned: 52, delta: "-3.1", mlb_id: 622663 },
    ],
    ai_recommendation: "Esteury Ruiz (+12.3%) is the hottest add — his elite speed directly addresses your NSB weakness (10th). Grab before ownership spikes.",
  },

  // ── Category Check (Week 7) ───────────────────────────────────────────
  // Values match matchup-detail my_value column. Ranks = position among 12 teams.
  // For negative categories (K-bat, L, ER): rank 1 = fewest (best).
  // For rate stats (ERA, WHIP): rank 1 = lowest (best).
  "category-check": {
    week: 7,
    categories: [
      { name: "R", value: "38", rank: 4, total: 12, strength: "" },
      { name: "H", value: "68", rank: 5, total: 12, strength: "" },
      { name: "HR", value: "12", rank: 3, total: 12, strength: "strong" },
      { name: "RBI", value: "34", rank: 4, total: 12, strength: "" },
      { name: "K", value: "52", rank: 7, total: 12, strength: "" },
      { name: "TB", value: "118", rank: 5, total: 12, strength: "" },
      { name: "AVG", value: ".265", rank: 8, total: 12, strength: "" },
      { name: "OBP", value: ".338", rank: 5, total: 12, strength: "" },
      { name: "XBH", value: "22", rank: 3, total: 12, strength: "strong" },
      { name: "NSB", value: "3", rank: 10, total: 12, strength: "weak" },
      { name: "IP", value: "44.2", rank: 9, total: 12, strength: "weak" },
      { name: "W", value: "3", rank: 4, total: 12, strength: "" },
      { name: "L", value: "1", rank: 2, total: 12, strength: "strong" },
      { name: "ER", value: "18", rank: 5, total: 12, strength: "" },
      { name: "K", value: "48", rank: 6, total: 12, strength: "" },
      { name: "HLD", value: "2", rank: 7, total: 12, strength: "" },
      { name: "ERA", value: "3.92", rank: 8, total: 12, strength: "" },
      { name: "WHIP", value: "1.18", rank: 4, total: 12, strength: "" },
      { name: "QS", value: "3", rank: 6, total: 12, strength: "" },
      { name: "NSV", value: "1", rank: 10, total: 12, strength: "weak" },
    ],
    strongest: ["HR", "XBH", "L"],
    weakest: ["NSB", "NSV", "IP"],
    ai_recommendation: "Bottom-3 in NSB (10th), NSV (10th), and IP (9th). All are actionable — target speed on waivers and stream a closer for saves.",
  },

  // ── Injury Report ─────────────────────────────────────────────────────
  "injury-report": {
    injured_active: [
      { name: "Mookie Betts", position: "SS,OF", status: "10-Day IL", description: "Left hand fracture", location: "active", mlb_id: 605141 },
      { name: "Spencer Strider", position: "SP", status: "60-Day IL", description: "UCL reconstruction", location: "active", mlb_id: 675911 },
    ],
    healthy_il: [
      { name: "Fernando Tatis Jr.", position: "OF,SS", status: "Healthy", description: "Eligible to activate", location: "il", mlb_id: 665487 },
    ],
    injured_bench: [
      { name: "Cody Bellinger", position: "OF,1B", status: "DTD", description: "Back tightness", location: "bench", mlb_id: 641355 },
    ],
    il_proper: [
      { name: "Jacob deGrom", position: "SP", status: "60-Day IL", description: "Tommy John recovery", location: "il", mlb_id: 594798 },
    ],
    ai_recommendation: "2 injured starters need attention. Move Betts to IL and activate Tatis Jr. who's healthy and burning an IL slot. Monitor Bellinger's back before Sunday.",
  },

  // ── Waiver Analysis ───────────────────────────────────────────────────
  // Weak categories (NSB, NSV) from category-check drive these recommendations.
  "waiver-analyze": {
    pos_type: "B",
    weak_categories: [
      { name: "NSB", rank: 10, total: 12 },
      { name: "NSV", rank: 10, total: 12 },
    ],
    recommendations: [
      { name: "Esteury Ruiz", pid: "682650", positions: "OF,DH", status: "Healthy", score: 8.7, pct: 45, mlb_id: 682650, trend: { direction: "added", delta: "+12.3", rank: 3, percent_owned: 45 }, intel: { statcast: { quality_tier: "average", sprint_speed: 30.2, speed_pct_rank: 99, xwoba_pct_rank: 42 }, trends: { hot_cold: "hot", last_14_days: { avg: ".305", sb: 8 } } } },
      { name: "Jose Caballero", pid: "660968", positions: "SS,2B", status: "Healthy", score: 7.2, pct: 32, mlb_id: 660968, trend: { direction: "added", delta: "+8.1", rank: 11, percent_owned: 32 }, intel: { statcast: { quality_tier: "below", sprint_speed: 29.8, speed_pct_rank: 95 }, trends: { hot_cold: "warm" } } },
      { name: "Jake Fraley", pid: "641584", positions: "OF", status: "Healthy", score: 6.8, pct: 28, mlb_id: 641584, intel: { statcast: { quality_tier: "average", xwoba_pct_rank: 55 }, trends: { hot_cold: "neutral" } } },
      { name: "Cedric Mullins", pid: "656775", positions: "OF", status: "Healthy", score: 5.9, pct: 51, mlb_id: 656775, trend: { direction: "dropped", delta: "-6.4", rank: 8, percent_owned: 51 }, intel: { statcast: { quality_tier: "average", sprint_speed: 28.5, speed_pct_rank: 80, xwoba_pct_rank: 48 }, trends: { hot_cold: "cold" } } },
      { name: "Isiah Kiner-Falefa", pid: "643396", positions: "3B,SS", status: "Healthy", score: 5.1, pct: 22, mlb_id: 643396, intel: { statcast: { quality_tier: "below", xwoba_pct_rank: 32 }, trends: { hot_cold: "neutral" } } },
    ],
    ai_recommendation: "Top target: Esteury Ruiz (45% owned). Elite sprint speed (99th percentile) directly addresses your worst category NSB (10th). Add immediately before ownership spikes.",
  },

  // ── Trade Evaluation ──────────────────────────────────────────────────
  "trade-eval": {
    give_players: [
      { name: "Pete Alonso", player_id: "624413", positions: ["1B"], value: 12.4, mlb_id: 624413 },
    ],
    get_players: [
      { name: "Julio Rodriguez", player_id: "677594", positions: ["OF"], value: 9.8, mlb_id: 677594 },
      { name: "Josh Hader", player_id: "623352", positions: ["RP"], value: 5.2, mlb_id: 623352 },
    ],
    give_value: 12.4,
    get_value: 15.0,
    net_value: 2.6,
    grade: "B+",
    position_impact: {
      losing: ["1B"],
      gaining: ["OF", "RP"],
    },
    ai_recommendation: "Grade: B+. Net gain of +2.6 z-score. You lose 1B depth but gain OF and saves. Worth it if you can stream a 1B replacement.",
  },

  // ── Free Agents ───────────────────────────────────────────────────────
  "free-agents": {
    type: "free-agents",
    pos_type: "B",
    count: 10,
    players: [
      { name: "Esteury Ruiz", player_id: "682650", positions: "OF,DH", percent_owned: 45, status: "Healthy", team: "OAK", mlb_id: 682650, stats: { R: 32, H: 55, HR: 3, RBI: 18, K: 52, TB: 72, AVG: ".248", OBP: ".315", XBH: 10, NSB: 22 }, trend: { direction: "added", delta: "+12.3", rank: 3, percent_owned: 45 }, intel: { statcast: { quality_tier: "average", sprint_speed: 30.2, speed_pct_rank: 99 }, trends: { hot_cold: "hot" } } },
      { name: "Cedric Mullins", player_id: "656775", positions: "OF", percent_owned: 51, status: "Healthy", team: "BAL", mlb_id: 656775, stats: { R: 28, H: 48, HR: 5, RBI: 20, K: 62, TB: 78, AVG: ".235", OBP: ".298", XBH: 14, NSB: 8 }, trend: { direction: "dropped", delta: "-6.4", rank: 8, percent_owned: 51 }, intel: { statcast: { quality_tier: "average", sprint_speed: 28.5, speed_pct_rank: 80 }, trends: { hot_cold: "cold" } } },
      { name: "Jake Fraley", player_id: "641584", positions: "OF", percent_owned: 28, status: "Healthy", team: "CIN", mlb_id: 641584, stats: { R: 25, H: 42, HR: 7, RBI: 24, K: 55, TB: 75, AVG: ".252", OBP: ".342", XBH: 16, NSB: 3 }, intel: { statcast: { quality_tier: "average" }, trends: { hot_cold: "neutral" } } },
      { name: "Isiah Kiner-Falefa", player_id: "643396", positions: "3B,SS", percent_owned: 22, status: "Healthy", team: "TOR", mlb_id: 643396, stats: { R: 22, H: 52, HR: 2, RBI: 18, K: 38, TB: 64, AVG: ".265", OBP: ".312", XBH: 8, NSB: 6 }, intel: { statcast: { quality_tier: "below" }, trends: { hot_cold: "neutral" } } },
      { name: "Colt Keith", player_id: "700363", positions: "2B,3B", percent_owned: 55, status: "Healthy", team: "DET", mlb_id: 700363, stats: { R: 35, H: 65, HR: 10, RBI: 35, K: 48, TB: 112, AVG: ".298", OBP: ".365", XBH: 22, NSB: 2 }, intel: { statcast: { quality_tier: "strong", xwoba_pct_rank: 72, ev_pct_rank: 68 }, trends: { hot_cold: "hot" }, context: { reddit_mentions: 3, reddit_sentiment: "positive", recent_headlines: ["Colt Keith quietly slashing .298/.365/.512"] } } },
      { name: "Yainer Diaz", player_id: "673237", positions: "C,DH", percent_owned: 62, status: "Healthy", team: "HOU", mlb_id: 673237, stats: { R: 30, H: 58, HR: 8, RBI: 38, K: 35, TB: 95, AVG: ".278", OBP: ".325", XBH: 18, NSB: 0 }, intel: { statcast: { quality_tier: "strong", ev_pct_rank: 78 }, trends: { hot_cold: "warm" } } },
      { name: "Tyler O'Neill", player_id: "641933", positions: "OF", percent_owned: 38, status: "DTD", team: "BOS", mlb_id: 641933, stats: { R: 18, H: 32, HR: 8, RBI: 22, K: 48, TB: 68, AVG: ".228", OBP: ".312", XBH: 16, NSB: 1 }, intel: { statcast: { quality_tier: "strong", barrel_pct_rank: 85, ev_pct_rank: 82 }, trends: { hot_cold: "cold" } } },
      { name: "Josh Naylor", player_id: "647304", positions: "1B,DH", percent_owned: 71, status: "Healthy", team: "CLE", mlb_id: 647304, stats: { R: 32, H: 62, HR: 12, RBI: 42, K: 42, TB: 108, AVG: ".272", OBP: ".338", XBH: 22, NSB: 0 }, intel: { statcast: { quality_tier: "average", xwoba_pct_rank: 60 }, trends: { hot_cold: "warm" } } },
    ],
    ai_recommendation: "Colt Keith is the best available — elite Statcast profile (72nd xwOBA, 68th EV) at only 55% owned. His .298/.365/.512 line screams breakout.",
  },

  // ── Player List (enriched free agents with stats) ──────────────────────
  "player-list": {
    type: "player-list",
    pos_type: "B",
    count: 10,
    status: "FA",
    players: [
      { name: "Esteury Ruiz", player_id: "682650", eligible_positions: ["OF", "DH"], percent_owned: 45, percent_started: 32, preseason_pick: 180.2, current_pick: 142.5, status: "Healthy", team: "OAK", mlb_id: 682650, opponent: "vs SEA", roster_status: "FA", stats: { R: 32, H: 55, HR: 3, RBI: 18, K: 52, TB: 72, AVG: ".248", OBP: ".315", XBH: 10, NSB: 22 }, trend: { direction: "added", delta: "+12.3", rank: 3, percent_owned: 45 }, intel: { statcast: { quality_tier: "average", sprint_speed: 30.2, speed_pct_rank: 99 }, trends: { hot_cold: "hot" } } },
      { name: "Colt Keith", player_id: "700363", eligible_positions: ["2B", "3B"], percent_owned: 55, percent_started: 42, preseason_pick: 210.5, current_pick: 155.3, status: "Healthy", team: "DET", mlb_id: 700363, opponent: "@CLE", roster_status: "FA", stats: { R: 35, H: 65, HR: 10, RBI: 35, K: 48, TB: 112, AVG: ".298", OBP: ".365", XBH: 22, NSB: 2 }, intel: { statcast: { quality_tier: "strong", xwoba_pct_rank: 72, ev_pct_rank: 68 }, trends: { hot_cold: "hot" } } },
      { name: "Yainer Diaz", player_id: "673237", eligible_positions: ["C", "DH"], percent_owned: 62, percent_started: 48, preseason_pick: 145.0, current_pick: 120.8, status: "Healthy", team: "HOU", mlb_id: 673237, opponent: "vs MIN", roster_status: "FA", stats: { R: 30, H: 58, HR: 8, RBI: 38, K: 35, TB: 95, AVG: ".278", OBP: ".325", XBH: 18, NSB: 0 }, intel: { statcast: { quality_tier: "strong", ev_pct_rank: 78 }, trends: { hot_cold: "warm" } } },
      { name: "Josh Naylor", player_id: "647304", eligible_positions: ["1B", "DH"], percent_owned: 71, percent_started: 55, preseason_pick: 120.0, current_pick: 105.2, status: "Healthy", team: "CLE", mlb_id: 647304, opponent: "vs DET", roster_status: "FA", stats: { R: 32, H: 62, HR: 12, RBI: 42, K: 42, TB: 108, AVG: ".272", OBP: ".338", XBH: 22, NSB: 0 }, intel: { statcast: { quality_tier: "average", xwoba_pct_rank: 60 }, trends: { hot_cold: "warm" } } },
      { name: "Cedric Mullins", player_id: "656775", eligible_positions: ["OF"], percent_owned: 51, percent_started: 38, preseason_pick: 165.0, current_pick: 190.2, status: "Healthy", team: "BAL", mlb_id: 656775, roster_status: "FA", stats: { R: 28, H: 48, HR: 5, RBI: 20, K: 62, TB: 78, AVG: ".235", OBP: ".298", XBH: 14, NSB: 8 }, trend: { direction: "dropped", delta: "-6.4", rank: 8, percent_owned: 51 }, intel: { statcast: { quality_tier: "average" }, trends: { hot_cold: "cold" } } },
      { name: "Jake Fraley", player_id: "641584", eligible_positions: ["OF"], percent_owned: 28, percent_started: 18, status: "Healthy", team: "CIN", mlb_id: 641584, opponent: "@STL", roster_status: "FA", stats: { R: 25, H: 42, HR: 7, RBI: 24, K: 55, TB: 75, AVG: ".252", OBP: ".342", XBH: 16, NSB: 3 }, intel: { statcast: { quality_tier: "average" }, trends: { hot_cold: "neutral" } } },
      { name: "Isiah Kiner-Falefa", player_id: "643396", eligible_positions: ["3B", "SS"], percent_owned: 22, percent_started: 12, status: "Healthy", team: "TOR", mlb_id: 643396, roster_status: "FA", stats: { R: 22, H: 52, HR: 2, RBI: 18, K: 38, TB: 64, AVG: ".265", OBP: ".312", XBH: 8, NSB: 6 }, intel: { statcast: { quality_tier: "below" }, trends: { hot_cold: "neutral" } } },
      { name: "Tyler O'Neill", player_id: "641933", eligible_positions: ["OF"], percent_owned: 38, percent_started: 22, preseason_pick: 95.0, current_pick: 130.5, status: "DTD", team: "BOS", mlb_id: 641933, roster_status: "FA", stats: { R: 18, H: 32, HR: 8, RBI: 22, K: 48, TB: 68, AVG: ".228", OBP: ".312", XBH: 16, NSB: 1 }, intel: { statcast: { quality_tier: "strong", barrel_pct_rank: 85, ev_pct_rank: 82 }, trends: { hot_cold: "cold" } } },
      { name: "Colton Cowser", player_id: "681297", eligible_positions: ["OF"], percent_owned: 48, percent_started: 35, preseason_pick: 175.0, current_pick: 148.3, status: "Healthy", team: "BAL", mlb_id: 681297, opponent: "@NYY", roster_status: "FA", stats: { R: 30, H: 50, HR: 9, RBI: 28, K: 55, TB: 88, AVG: ".245", OBP: ".330", XBH: 18, NSB: 4 }, intel: { statcast: { quality_tier: "average" }, trends: { hot_cold: "warm" } } },
      { name: "Dylan Crews", player_id: "700364", eligible_positions: ["OF"], percent_owned: 38, percent_started: 25, preseason_pick: 200.0, current_pick: 165.0, status: "Healthy", team: "WSH", mlb_id: 700364, opponent: "vs PHI", roster_status: "FA", stats: { R: 22, H: 42, HR: 6, RBI: 20, K: 50, TB: 72, AVG: ".240", OBP: ".318", XBH: 14, NSB: 5 }, intel: { statcast: { quality_tier: "average" }, trends: { hot_cold: "neutral" } } },
    ],
    ai_recommendation: "Colt Keith is the top pickup — elite Statcast profile at 55% owned. His 2B/3B eligibility adds roster flexibility.",
  },

  // ── Draft Status (Round 6 of 2026 draft) ──────────────────────────────
  // 12 teams, 5 completed rounds = 60 picks, entering round 6.
  "draft-status": {
    total_picks: 60,
    current_round: 6,
    my_picks: 5,
    my_hitters: 3,
    my_pitchers: 2,
    drafted_ids: Array.from({ length: 60 }, function (_, i) { return "player_" + i; }),
    ai_recommendation: "Round 6 with 3 hitters and 2 pitchers. Target a hitter this round — SP value drops off a cliff after round 6.",
  },

  // ── Draft Recommendation (Round 6) ────────────────────────────────────
  "draft-recommend": {
    round: 6,
    recommendation: "Target a hitter this round. Your pitching is solid but you need more batting depth, especially power.",
    top_pick: { name: "Vladimir Guerrero Jr.", type: "hitter", z_score: 2.34 },
    top_hitters: [
      { name: "Vladimir Guerrero Jr.", positions: ["1B", "DH"], z_score: 2.34, mlb_id: 665489 },
      { name: "Bobby Witt Jr.", positions: ["SS"], z_score: 2.18, mlb_id: 677951 },
      { name: "Corey Seager", positions: ["SS"], z_score: 1.85, mlb_id: 608369 },
      { name: "Rafael Devers", positions: ["3B"], z_score: 1.72, mlb_id: 646240 },
      { name: "Marcus Semien", positions: ["2B"], z_score: 1.21, mlb_id: 543760 },
      { name: "Pete Alonso", positions: ["1B"], z_score: 0.94, mlb_id: 624413 },
      { name: "Julio Rodriguez", positions: ["OF"], z_score: 0.81, mlb_id: 677594 },
      { name: "Corbin Carroll", positions: ["OF"], z_score: 0.42, mlb_id: 682998 },
    ],
    top_pitchers: [
      { name: "Gerrit Cole", positions: ["SP"], z_score: 2.56, mlb_id: 543037 },
      { name: "Zack Wheeler", positions: ["SP"], z_score: 2.12, mlb_id: 554430 },
      { name: "Corbin Burnes", positions: ["SP"], z_score: 1.88, mlb_id: 669203 },
      { name: "Logan Webb", positions: ["SP"], z_score: 1.45, mlb_id: 657277 },
      { name: "Yu Darvish", positions: ["SP"], z_score: 0.98, mlb_id: 506433 },
      { name: "Sonny Gray", positions: ["SP"], z_score: 0.67, mlb_id: 543243 },
    ],
    hitters_count: 3,
    pitchers_count: 2,
    ai_recommendation: "Take Vladimir Guerrero Jr. (z-score 2.34). Elite bat still on the board at 1B. Your pitching is solid with 2 already — load up on hitting.",
  },

  // ── Draft Cheat Sheet ─────────────────────────────────────────────────
  "draft-cheatsheet": {
    strategy: {
      "1": "Take the best hitter available. Elite bats are scarce - target Ohtani, Judge, or Soto.",
      "2": "Grab a top-tier ace if one falls. Otherwise take another elite bat.",
      "3": "Start building pitching depth. Look for a high-K starter with a good WHIP.",
      "4": "Best available hitter to round out your lineup. Prioritize power + speed combo.",
      "5": "Target a closer or elite reliever for saves. HLD/NSV are hard to find later.",
    },
    targets: {
      "Power Hitters": ["Aaron Judge", "Pete Alonso", "Yordan Alvarez", "Kyle Schwarber"],
      "Speed + Contact": ["Bobby Witt Jr.", "Trea Turner", "Corbin Carroll", "Elly De La Cruz"],
      "Aces": ["Gerrit Cole", "Spencer Strider", "Zack Wheeler", "Corbin Burnes"],
      "Closers": ["Josh Hader", "Emmanuel Clase", "Ryan Helsley", "Devin Williams"],
    },
    avoid: ["Miguel Andujar", "Joey Gallo", "Andrew Benintendi"],
    opponents: [
      { name: "Dynasty Destroyers", tendency: "Prioritizes pitching early, reaches for closers" },
      { name: "The Lumber Yard", tendency: "Heavy on power hitters, ignores speed" },
      { name: "Strikeout Kings", tendency: "Always takes K pitchers first 3 rounds" },
    ],
    ai_recommendation: "Dynasty Destroyers always grabs pitching early — your target aces will go fast. Grab one by round 3 or pivot to closers in round 5.",
  },

  // ── Best Available (Draft) ────────────────────────────────────────────
  "best-available": {
    pos_type: "B",
    count: 15,
    players: [
      { rank: 1, name: "Vladimir Guerrero Jr.", positions: ["1B", "DH"], z_score: 2.34, mlb_id: 665489 },
      { rank: 2, name: "Bobby Witt Jr.", positions: ["SS"], z_score: 2.18, mlb_id: 677951 },
      { rank: 3, name: "Corey Seager", positions: ["SS"], z_score: 1.85, mlb_id: 608369 },
      { rank: 4, name: "Rafael Devers", positions: ["3B"], z_score: 1.72, mlb_id: 646240 },
      { rank: 5, name: "Gunnar Henderson", positions: ["SS", "3B"], z_score: 1.65, mlb_id: 683002 },
      { rank: 6, name: "Marcus Semien", positions: ["2B"], z_score: 1.21, mlb_id: 543760 },
      { rank: 7, name: "Pete Alonso", positions: ["1B"], z_score: 0.94, mlb_id: 624413 },
      { rank: 8, name: "Julio Rodriguez", positions: ["OF"], z_score: 0.81, mlb_id: 677594 },
      { rank: 9, name: "Adley Rutschman", positions: ["C"], z_score: 0.72, mlb_id: 668939 },
      { rank: 10, name: "Corbin Carroll", positions: ["OF"], z_score: 0.42, mlb_id: 682998 },
      { rank: 11, name: "Jose Ramirez", positions: ["3B"], z_score: 0.35, mlb_id: 608070 },
      { rank: 12, name: "Willy Adames", positions: ["SS"], z_score: 0.12, mlb_id: 642715 },
      { rank: 13, name: "Ozzie Albies", positions: ["2B"], z_score: -0.05, mlb_id: 645277 },
      { rank: 14, name: "Salvador Perez", positions: ["C", "DH"], z_score: -0.18, mlb_id: 521692 },
      { rank: 15, name: "Tyler O'Neill", positions: ["OF"], z_score: -0.32, mlb_id: 641933 },
    ],
    ai_recommendation: "Best value on the board: Vladimir Guerrero Jr. (z-score 2.34). Elite tier player — don't let him slip past round 6.",
  },

  // ── League History ────────────────────────────────────────────────────
  // Records = matchup record for 22-week seasons.
  "league-history": {
    seasons: [
      { year: 2025, champion: "Dynasty Destroyers", your_finish: "4th", your_record: "13-8-1" },
      { year: 2024, champion: "Home Run Heroes", your_finish: "1st", your_record: "16-5-1" },
      { year: 2023, champion: "Strikeout Kings", your_finish: "3rd", your_record: "14-7-1" },
      { year: 2022, champion: "The Lumber Yard", your_finish: "6th", your_record: "10-11-1" },
      { year: 2021, champion: "Big Poppa Pump", your_finish: "2nd", your_record: "15-6-1" },
      { year: 2020, champion: "Dynasty Destroyers", your_finish: "5th", your_record: "11-10-1" },
      { year: 2019, champion: "Caught Stealing Hearts", your_finish: "7th", your_record: "9-12-1" },
      { year: 2018, champion: "Home Run Heroes", your_finish: "1st", your_record: "17-4-1" },
      { year: 2017, champion: "Walk-Off Winners", your_finish: "4th", your_record: "12-9-1" },
      { year: 2016, champion: "Dynasty Destroyers", your_finish: "8th", your_record: "9-13-0" },
      { year: 2015, champion: "The Lumber Yard", your_finish: "3rd", your_record: "14-7-1" },
      { year: 2014, champion: "Strikeout Kings", your_finish: "5th", your_record: "11-10-1" },
      { year: 2013, champion: "Big Poppa Pump" },
      { year: 2012, champion: "Dynasty Destroyers" },
    ],
  },

  // ── Record Book ───────────────────────────────────────────────────────
  // 22-week seasons. Career stats: 14 seasons × 22 weeks = 308 matchups (264 for 12-season managers).
  "record-book": {
    champions: [
      { year: 2025, team_name: "Dynasty Destroyers", manager: "Manager B", record: "18-3-1", win_pct: 81.8 },
      { year: 2024, team_name: "Home Run Heroes", manager: "Manager A", record: "16-5-1", win_pct: 72.7 },
      { year: 2023, team_name: "Strikeout Kings", manager: "Manager C", record: "15-6-1", win_pct: 68.2 },
      { year: 2022, team_name: "The Lumber Yard", manager: "Manager E", record: "14-7-1", win_pct: 63.6 },
      { year: 2021, team_name: "Big Poppa Pump", manager: "Manager D", record: "16-5-1", win_pct: 72.7 },
      { year: 2020, team_name: "Dynasty Destroyers", manager: "Manager B", record: "15-6-1", win_pct: 68.2 },
    ],
    careers: [
      { manager: "Manager B", seasons: 14, wins: 168, losses: 127, ties: 13, win_pct: 54.5, playoffs: 10, best_finish: 1, best_year: 2025 },
      { manager: "Manager A", seasons: 14, wins: 162, losses: 133, ties: 13, win_pct: 52.6, playoffs: 9, best_finish: 1, best_year: 2024 },
      { manager: "Manager C", seasons: 14, wins: 155, losses: 140, ties: 13, win_pct: 50.3, playoffs: 7, best_finish: 1, best_year: 2023 },
      { manager: "Manager D", seasons: 14, wins: 160, losses: 135, ties: 13, win_pct: 51.9, playoffs: 8, best_finish: 1, best_year: 2021 },
      { manager: "Manager E", seasons: 14, wins: 148, losses: 147, ties: 13, win_pct: 48.1, playoffs: 6, best_finish: 1, best_year: 2022 },
      { manager: "Manager F", seasons: 12, wins: 120, losses: 137, ties: 7, win_pct: 45.5, playoffs: 4, best_finish: 2, best_year: 2019 },
    ],
    first_picks: [
      { year: 2025, player: "Shohei Ohtani" },
      { year: 2024, player: "Ronald Acuna Jr." },
      { year: 2023, player: "Trea Turner" },
      { year: 2022, player: "Shohei Ohtani" },
      { year: 2021, player: "Mike Trout" },
      { year: 2020, player: "Mike Trout" },
    ],
    playoff_appearances: [
      { manager: "Manager B", appearances: 10 },
      { manager: "Manager A", appearances: 9 },
      { manager: "Manager D", appearances: 8 },
      { manager: "Manager C", appearances: 7 },
      { manager: "Manager E", appearances: 6 },
      { manager: "Manager F", appearances: 4 },
    ],
  },

  // ── Past Standings (2025 season, 22 weeks) ────────────────────────────
  "past-standings": {
    year: 2025,
    standings: [
      { rank: 1, team_name: "Dynasty Destroyers", manager: "Manager B", record: "18-3-1" },
      { rank: 2, team_name: "Big Poppa Pump", manager: "Manager D", record: "15-6-1" },
      { rank: 3, team_name: "Strikeout Kings", manager: "Manager C", record: "14-7-1" },
      { rank: 4, team_name: "Home Run Heroes", manager: "Manager A", record: "13-8-1" },
      { rank: 5, team_name: "The Lumber Yard", manager: "Manager E", record: "12-9-1" },
      { rank: 6, team_name: "Designated Drinkers", manager: "Manager F", record: "11-10-1" },
      { rank: 7, team_name: "Caught Stealing Hearts", manager: "Manager G", record: "10-11-1" },
      { rank: 8, team_name: "Walk-Off Winners", manager: "Manager H", record: "9-12-1" },
      { rank: 9, team_name: "Error 404: Wins Not Found", manager: "Manager I", record: "8-13-1" },
      { rank: 10, team_name: "The Mendoza Liners", manager: "Manager J", record: "7-14-1" },
      { rank: 11, team_name: "Balk Street Boys", manager: "Manager K", record: "6-16-0" },
      { rank: 12, team_name: "Foul Territory", manager: "Manager L", record: "4-17-1" },
    ],
  },

  // ── Past Draft (2025, Rounds 1-2) ─────────────────────────────────────
  "past-draft": {
    year: 2025,
    picks: [
      { round: 1, pick: 1, player_name: "Shohei Ohtani", team_name: "Dynasty Destroyers" },
      { round: 1, pick: 2, player_name: "Aaron Judge", team_name: "Strikeout Kings" },
      { round: 1, pick: 3, player_name: "Mookie Betts", team_name: "Home Run Heroes" },
      { round: 1, pick: 4, player_name: "Ronald Acuna Jr.", team_name: "Big Poppa Pump" },
      { round: 1, pick: 5, player_name: "Juan Soto", team_name: "The Lumber Yard" },
      { round: 1, pick: 6, player_name: "Freddie Freeman", team_name: "Designated Drinkers" },
      { round: 1, pick: 7, player_name: "Trea Turner", team_name: "Caught Stealing Hearts" },
      { round: 1, pick: 8, player_name: "Corey Seager", team_name: "Walk-Off Winners" },
      { round: 1, pick: 9, player_name: "Bobby Witt Jr.", team_name: "Error 404: Wins Not Found" },
      { round: 1, pick: 10, player_name: "Yordan Alvarez", team_name: "The Mendoza Liners" },
      { round: 1, pick: 11, player_name: "Fernando Tatis Jr.", team_name: "Balk Street Boys" },
      { round: 1, pick: 12, player_name: "Gerrit Cole", team_name: "Foul Territory" },
      { round: 2, pick: 13, player_name: "Zack Wheeler", team_name: "Foul Territory" },
      { round: 2, pick: 14, player_name: "Spencer Strider", team_name: "Balk Street Boys" },
      { round: 2, pick: 15, player_name: "Vladimir Guerrero Jr.", team_name: "The Mendoza Liners" },
      { round: 2, pick: 16, player_name: "Corbin Burnes", team_name: "Error 404: Wins Not Found" },
      { round: 2, pick: 17, player_name: "Rafael Devers", team_name: "Walk-Off Winners" },
      { round: 2, pick: 18, player_name: "Kyle Tucker", team_name: "Caught Stealing Hearts" },
      { round: 2, pick: 19, player_name: "Marcus Semien", team_name: "Designated Drinkers" },
      { round: 2, pick: 20, player_name: "Matt Olson", team_name: "The Lumber Yard" },
      { round: 2, pick: 21, player_name: "Gunnar Henderson", team_name: "Big Poppa Pump" },
      { round: 2, pick: 22, player_name: "Julio Rodriguez", team_name: "Home Run Heroes" },
      { round: 2, pick: 23, player_name: "Adley Rutschman", team_name: "Strikeout Kings" },
      { round: 2, pick: 24, player_name: "Pete Alonso", team_name: "Dynasty Destroyers" },
    ],
  },

  // ── Past Teams (2025 activity) ────────────────────────────────────────
  "past-teams": {
    year: 2025,
    teams: [
      { name: "Dynasty Destroyers", manager: "Manager B", moves: 47, trades: 3 },
      { name: "Big Poppa Pump", manager: "Manager D", moves: 38, trades: 2 },
      { name: "Strikeout Kings", manager: "Manager C", moves: 42, trades: 1 },
      { name: "Home Run Heroes", manager: "Manager A", moves: 51, trades: 4 },
      { name: "The Lumber Yard", manager: "Manager E", moves: 35, trades: 2 },
      { name: "Designated Drinkers", manager: "Manager F", moves: 29, trades: 0 },
      { name: "Caught Stealing Hearts", manager: "Manager G", moves: 33, trades: 1 },
      { name: "Walk-Off Winners", manager: "Manager H", moves: 26, trades: 1 },
      { name: "Error 404: Wins Not Found", manager: "Manager I", moves: 44, trades: 2 },
      { name: "The Mendoza Liners", manager: "Manager J", moves: 18, trades: 0 },
      { name: "Balk Street Boys", manager: "Manager K", moves: 22, trades: 1 },
      { name: "Foul Territory", manager: "Manager L", moves: 14, trades: 0 },
    ],
  },

  // ── Past Trades (2025) ────────────────────────────────────────────────
  "past-trades": {
    year: 2025,
    trades: [
      {
        team1: "Home Run Heroes",
        team2: "Dynasty Destroyers",
        players1: ["Pete Alonso", "Logan Webb"],
        players2: ["Juan Soto"],
      },
      {
        team1: "Big Poppa Pump",
        team2: "The Lumber Yard",
        players1: ["Gerrit Cole"],
        players2: ["Yordan Alvarez", "Josh Hader"],
      },
      {
        team1: "Strikeout Kings",
        team2: "Caught Stealing Hearts",
        players1: ["Fernando Tatis Jr."],
        players2: ["Corbin Burnes", "Cedric Mullins"],
      },
    ],
  },

  // ── Past Matchup (2025, Week 1 Final Results) ─────────────────────────
  // Scores = category results out of 20 categories (W-L-T, team1 perspective).
  "past-matchup": {
    year: 2025,
    week: 1,
    matchups: [
      { team1: "Dynasty Destroyers", team2: "Foul Territory", score: "16-3-1", status: "Final" },
      { team1: "Strikeout Kings", team2: "Walk-Off Winners", score: "12-6-2", status: "Final" },
      { team1: "Home Run Heroes", team2: "Big Poppa Pump", score: "10-8-2", status: "Final" },
      { team1: "The Lumber Yard", team2: "Balk Street Boys", score: "13-5-2", status: "Final" },
      { team1: "Designated Drinkers", team2: "The Mendoza Liners", score: "11-7-2", status: "Final" },
      { team1: "Caught Stealing Hearts", team2: "Error 404: Wins Not Found", score: "8-11-1", status: "Final" },
    ],
  },

  // ── Roster ──────────────────────────────────────────────────────────────
  // 14 roster slots: C, 1B, 2B, SS, 3B, OF×3, UTIL, BN×3, SP/RP split across IL.
  roster: {
    players: [
      { name: "Adley Rutschman", player_id: "668939", position: "C", eligible_positions: ["C", "UTIL"], status: "Healthy", team: "BAL", mlb_id: 668939, opponent: "vs NYY", percent_started: 94, percent_owned: 99, preseason_pick: 18.5, current_pick: 22.1, stats: { R: 42, H: 71, HR: 12, RBI: 45, K: 58, TB: 128, AVG: ".268", OBP: ".365", XBH: 28, NSB: 1 }, intel: { statcast: { quality_tier: "strong", xwoba_pct_rank: 78, ev_pct_rank: 72, barrel_pct_rank: 65 }, trends: { hot_cold: "cold", last_14_days: { avg: ".215", hr: 1, rbi: 4 } } } },
      { name: "Pete Alonso", player_id: "624413", position: "1B", eligible_positions: ["1B", "UTIL"], status: "Healthy", team: "NYM", mlb_id: 624413, opponent: "vs ATL", percent_started: 97, percent_owned: 99, preseason_pick: 25.0, current_pick: 28.3, stats: { R: 38, H: 62, HR: 18, RBI: 52, K: 72, TB: 142, AVG: ".245", OBP: ".328", XBH: 32, NSB: 0 }, intel: { statcast: { quality_tier: "strong", xwoba_pct_rank: 85, ev_pct_rank: 90, barrel_pct_rank: 88, hard_hit_rate: 48.2, hh_pct_rank: 82 }, trends: { hot_cold: "warm" } } },
      { name: "Marcus Semien", player_id: "543760", position: "2B", eligible_positions: ["2B", "UTIL"], status: "Healthy", team: "TEX", mlb_id: 543760, opponent: "@CLE", percent_started: 88, percent_owned: 98, preseason_pick: 42.0, current_pick: 48.7, stats: { R: 45, H: 68, HR: 10, RBI: 38, K: 55, TB: 112, AVG: ".258", OBP: ".322", XBH: 22, NSB: 5 }, intel: { statcast: { quality_tier: "average", xwoba_pct_rank: 62 }, trends: { hot_cold: "neutral" } } },
      { name: "Bobby Witt Jr.", player_id: "677951", position: "SS", eligible_positions: ["SS", "3B", "UTIL"], status: "Healthy", team: "KC", mlb_id: 677951, opponent: "vs DET", percent_started: 99, percent_owned: 100, preseason_pick: 3.0, current_pick: 2.8, stats: { R: 58, H: 95, HR: 15, RBI: 48, K: 42, TB: 168, AVG: ".318", OBP: ".368", XBH: 35, NSB: 18 }, intel: { statcast: { quality_tier: "elite", xwoba_pct_rank: 95, ev_pct_rank: 88, barrel_pct_rank: 82, sprint_speed: 29.5, speed_pct_rank: 92 }, trends: { hot_cold: "hot", last_14_days: { avg: ".355", hr: 3, rbi: 12, sb: 4 } } } },
      { name: "Rafael Devers", player_id: "646240", position: "3B", eligible_positions: ["3B", "UTIL"], status: "Healthy", team: "BOS", mlb_id: 646240, opponent: "@TB", percent_started: 96, percent_owned: 99, preseason_pick: 15.0, current_pick: 16.2, stats: { R: 44, H: 78, HR: 16, RBI: 50, K: 65, TB: 148, AVG: ".282", OBP: ".348", XBH: 34, NSB: 1 }, intel: { statcast: { quality_tier: "strong", xwoba_pct_rank: 82, ev_pct_rank: 85 }, trends: { hot_cold: "neutral" } } },
      { name: "Julio Rodriguez", player_id: "677594", position: "OF", eligible_positions: ["OF", "UTIL"], status: "Healthy", team: "SEA", mlb_id: 677594, opponent: "vs LAA", percent_started: 95, percent_owned: 99, preseason_pick: 8.0, current_pick: 12.5, stats: { R: 48, H: 82, HR: 14, RBI: 42, K: 68, TB: 145, AVG: ".275", OBP: ".335", XBH: 30, NSB: 12 }, intel: { statcast: { quality_tier: "strong", xwoba_pct_rank: 75, ev_pct_rank: 92, barrel_pct_rank: 70, sprint_speed: 28.8, speed_pct_rank: 85 }, trends: { hot_cold: "warm", last_14_days: { avg: ".310", hr: 2, rbi: 8 } }, context: { reddit_mentions: 5, reddit_sentiment: "positive", recent_headlines: ["J-Rod exit velocity up 3 mph in last 2 weeks"] } } },
      { name: "Corbin Carroll", player_id: "682998", position: "OF", eligible_positions: ["OF", "UTIL"], status: "Healthy", team: "ARI", mlb_id: 682998, opponent: "@COL", percent_started: 82, percent_owned: 97, preseason_pick: 12.0, current_pick: 35.4, stats: { R: 35, H: 58, HR: 8, RBI: 28, K: 78, TB: 95, AVG: ".238", OBP: ".312", XBH: 18, NSB: 8 }, intel: { statcast: { quality_tier: "average", xwoba_pct_rank: 55, ev_pct_rank: 42, barrel_pct_rank: 38 }, trends: { hot_cold: "cold" }, context: { reddit_mentions: 3, reddit_sentiment: "negative", recent_headlines: ["Carroll owners - sell or hold?"] } } },
      { name: "Juan Soto", player_id: "665742", position: "OF", eligible_positions: ["OF", "UTIL"], status: "Healthy", team: "NYM", mlb_id: 665742, opponent: "vs ATL", percent_started: 99, percent_owned: 100, preseason_pick: 2.0, current_pick: 1.5, stats: { R: 55, H: 85, HR: 18, RBI: 48, K: 52, TB: 162, AVG: ".298", OBP: ".425", XBH: 38, NSB: 2 }, intel: { statcast: { quality_tier: "elite", xwoba_pct_rank: 97, ev_pct_rank: 88, barrel_pct_rank: 90 }, trends: { hot_cold: "hot" }, discipline: { bb_rate: 16.8, k_rate: 18.2, o_swing_pct: 22.1 } } },
      { name: "Gunnar Henderson", player_id: "683002", position: "UTIL", eligible_positions: ["SS", "3B", "UTIL"], status: "Healthy", team: "BAL", mlb_id: 683002, opponent: "vs NYY", percent_started: 97, percent_owned: 100, preseason_pick: 5.0, current_pick: 4.2, stats: { R: 52, H: 78, HR: 17, RBI: 46, K: 62, TB: 152, AVG: ".272", OBP: ".358", XBH: 36, NSB: 6 }, intel: { statcast: { quality_tier: "elite", xwoba_pct_rank: 92, ev_pct_rank: 86, barrel_pct_rank: 84 }, trends: { hot_cold: "warm" } } },
      { name: "Cody Bellinger", player_id: "641355", position: "BN", eligible_positions: ["OF", "1B", "UTIL"], status: "DTD", team: "CHC", mlb_id: 641355, percent_started: 45, percent_owned: 92, preseason_pick: 55.0, current_pick: 72.8, stats: { R: 22, H: 42, HR: 6, RBI: 22, K: 48, TB: 68, AVG: ".242", OBP: ".308", XBH: 12, NSB: 2 }, intel: { statcast: { quality_tier: "below", xwoba_pct_rank: 35 }, trends: { hot_cold: "cold" } } },
      { name: "Ozzie Albies", player_id: "645277", position: "BN", eligible_positions: ["2B", "UTIL"], status: "Healthy", team: "ATL", mlb_id: 645277, opponent: "@NYM", percent_started: 72, percent_owned: 96, preseason_pick: 38.0, current_pick: 42.5, stats: { R: 35, H: 62, HR: 9, RBI: 32, K: 45, TB: 105, AVG: ".268", OBP: ".318", XBH: 20, NSB: 4 }, intel: { statcast: { quality_tier: "average", xwoba_pct_rank: 58 }, trends: { hot_cold: "neutral" } } },
      { name: "Gerrit Cole", player_id: "543037", position: "SP", eligible_positions: ["SP"], status: "Healthy", team: "NYY", mlb_id: 543037, opponent: "@BAL", percent_started: 95, percent_owned: 99, preseason_pick: 10.0, current_pick: 14.8, stats: { IP: "82.1", W: 6, L: 3, ER: 28, K: 105, HLD: 0, ERA: "3.06", WHIP: "1.08", QS: 7, NSV: 0 }, intel: { statcast: { quality_tier: "elite", whiff_rate: 32.5, chase_rate: 34.2, xwoba: 0.275, xwoba_pct_rank: 95 }, trends: { hot_cold: "neutral" }, context: { reddit_mentions: 12, reddit_sentiment: "negative", recent_headlines: ["Cole scratched from start (undisclosed)"] } } },
      { name: "Josh Hader", player_id: "623352", position: "RP", eligible_positions: ["RP"], status: "Healthy", team: "HOU", mlb_id: 623352, opponent: "@MIN", percent_started: 68, percent_owned: 95, preseason_pick: 48.0, current_pick: 65.2, stats: { IP: "28.2", W: 1, L: 2, ER: 15, K: 35, HLD: 0, ERA: "4.71", WHIP: "1.22", QS: 0, NSV: 12 }, intel: { statcast: { quality_tier: "average", whiff_rate: 28.1, chase_rate: 29.5 }, trends: { hot_cold: "cold" }, context: { reddit_mentions: 4, reddit_sentiment: "negative", recent_headlines: ["Is Hader cooked? 5.40 ERA in May"] } } },
      { name: "Jacob deGrom", player_id: "594798", position: "IL", eligible_positions: ["SP"], status: "60-Day IL", team: "TEX", mlb_id: 594798, percent_started: 0, percent_owned: 82, preseason_pick: 120.0, current_pick: 180.5 },
    ],
    ai_recommendation: "Roster health: 1 DTD (Bellinger), 1 IL stash (deGrom). Bobby Witt Jr. is scorching (.355 last 14 days). Consider selling high on Corbin Carroll — Statcast numbers are below average.",
  },

  // ── League Info ─────────────────────────────────────────────────────────
  info: {
    name: "Demo Fantasy League",
    draft_status: "postdraft",
    season: "2026",
    start_date: "2026-03-26",
    end_date: "2026-09-28",
    current_week: 7,
    num_teams: 12,
    num_playoff_teams: 6,
    max_weekly_adds: 7,
    team_name: "Home Run Heroes",
    team_id: "000.l.00000.t.12",
  },

  // ── Scoreboard ──────────────────────────────────────────────────────────
  scoreboard: {
    type: "scoreboard",
    week: "7",
    matchups: [
      { team1: "Home Run Heroes", team2: "Big Poppa Pump", status: "10-8-2" },
      { team1: "Dynasty Destroyers", team2: "Foul Territory", status: "15-4-1" },
      { team1: "The Lumber Yard", team2: "Balk Street Boys", status: "13-5-2" },
      { team1: "Strikeout Kings", team2: "Walk-Off Winners", status: "11-7-2" },
      { team1: "Designated Drinkers", team2: "The Mendoza Liners", status: "12-7-1" },
      { team1: "Caught Stealing Hearts", team2: "Error 404: Wins Not Found", status: "9-9-2" },
    ],
    ai_recommendation: "You're winning 10-8-2 against Big Poppa Pump. Focus on flipping HR and RBI — both within 2 of tying.",
  },

  // ── Stat Categories ─────────────────────────────────────────────────────
  "stat-categories": {
    categories: [
      { display_name: "Runs", name: "R", position_type: "B" },
      { display_name: "Hits", name: "H", position_type: "B" },
      { display_name: "Home Runs", name: "HR", position_type: "B" },
      { display_name: "RBI", name: "RBI", position_type: "B" },
      { display_name: "Strikeouts (Bat)", name: "K", position_type: "B" },
      { display_name: "Total Bases", name: "TB", position_type: "B" },
      { display_name: "Batting Average", name: "AVG", position_type: "B" },
      { display_name: "On-Base Percentage", name: "OBP", position_type: "B" },
      { display_name: "Extra-Base Hits", name: "XBH", position_type: "B" },
      { display_name: "Net Stolen Bases", name: "NSB", position_type: "B" },
      { display_name: "Innings Pitched", name: "IP", position_type: "P" },
      { display_name: "Wins", name: "W", position_type: "P" },
      { display_name: "Losses", name: "L", position_type: "P" },
      { display_name: "Earned Runs", name: "ER", position_type: "P" },
      { display_name: "Strikeouts (Pitch)", name: "K", position_type: "P" },
      { display_name: "Holds", name: "HLD", position_type: "P" },
      { display_name: "ERA", name: "ERA", position_type: "P" },
      { display_name: "WHIP", name: "WHIP", position_type: "P" },
      { display_name: "Quality Starts", name: "QS", position_type: "P" },
      { display_name: "Net Saves", name: "NSV", position_type: "P" },
    ],
    ai_recommendation: "Your league uses 20 categories (10B/10P). Negative categories (K-bat, L, ER) reward discipline. NSB and NSV reward elite closers and speed.",
  },

  // ── Lineup Optimize ─────────────────────────────────────────────────────
  "lineup-optimize": {
    active_off_day: [
      { name: "Pete Alonso", position: "1B", team: "NYM", mlb_id: 624413 },
      { name: "Corbin Carroll", position: "OF", team: "ARI", mlb_id: 682998 },
    ],
    bench_playing: [
      { name: "Ozzie Albies", position: "2B", team: "ATL", mlb_id: 645277 },
    ],
    il_players: [
      { name: "Jacob deGrom", position: "SP", team: "TEX", mlb_id: 594798 },
    ],
    swaps: [
      { bench_player: "Ozzie Albies", start_player: "Pete Alonso", position: "UTIL" },
    ],
    applied: false,
    message: "2 active players have no game today. 1 bench player is playing.",
    ai_recommendation: "2 starters sitting idle while 1 bench bat has a game. Swap in Ozzie Albies at UTIL for Pete Alonso — Albies has a game today and Alonso doesn't.",
  },

  // ── Streaming Pitchers ──────────────────────────────────────────────────
  streaming: {
    week: 7,
    team_games: { NYY: 6, LAD: 7, HOU: 6, ATL: 7, SD: 6, PHI: 7, SEA: 6, MIN: 7 },
    pitchers: [
      { name: "Bryce Miller", player_id: "682243", team: "SEA", games: 2, percent_owned: 42, score: 8.4, two_start: true, mlb_id: 682243, trend: { direction: "added", delta: "+9.5", rank: 7, percent_owned: 42 } },
      { name: "Bailey Ober", player_id: "641927", team: "MIN", games: 2, percent_owned: 38, score: 7.9, two_start: true, mlb_id: 641927 },
      { name: "Ranger Suarez", player_id: "624133", team: "PHI", games: 1, percent_owned: 55, score: 7.2, two_start: false, mlb_id: 624133 },
      { name: "Gavin Stone", player_id: "681024", team: "LAD", games: 1, percent_owned: 35, score: 6.8, two_start: false, mlb_id: 681024 },
      { name: "JP Sears", player_id: "676664", team: "OAK", games: 2, percent_owned: 22, score: 6.5, two_start: true, mlb_id: 676664 },
      { name: "Reese Olson", player_id: "680557", team: "DET", games: 1, percent_owned: 28, score: 5.9, two_start: false, mlb_id: 680557 },
      { name: "Andrew Abbott", player_id: "680737", team: "CIN", games: 1, percent_owned: 31, score: 5.4, two_start: false, mlb_id: 680737 },
      { name: "Colin Rea", player_id: "607067", team: "MIL", games: 2, percent_owned: 18, score: 5.1, two_start: true, mlb_id: 607067 },
    ],
    ai_recommendation: "Lead with Bryce Miller — 2 starts this week vs weak offenses. 42% owned so grab him now. Bailey Ober is your backup with 2 starts at 38% owned.",
  },

  // ── Daily Update ────────────────────────────────────────────────────────
  "daily-update": {
    lineup: {
      active_off_day: [
        { name: "Pete Alonso", position: "1B", team: "NYM", mlb_id: 624413 },
        { name: "Corbin Carroll", position: "OF", team: "ARI", mlb_id: 682998 },
      ],
      bench_playing: [
        { name: "Ozzie Albies", position: "2B", team: "ATL", mlb_id: 645277 },
      ],
      il_players: [],
      swaps: [
        { bench_player: "Ozzie Albies", start_player: "Pete Alonso", position: "UTIL" },
      ],
      applied: false,
      message: "",
    },
    injuries: {
      injured_active: [
        { name: "Cody Bellinger", position: "OF,1B", status: "DTD", description: "Back tightness", location: "active", mlb_id: 641355 },
      ],
      healthy_il: [],
      injured_bench: [],
      il_proper: [
        { name: "Jacob deGrom", position: "SP", status: "60-Day IL", description: "Tommy John recovery", location: "il", mlb_id: 594798 },
      ],
    },
    message: "Action needed: 2 active off-day players, 1 injury to monitor.",
    ai_recommendation: "Priority 1: Handle 2 lineup issues — swap Albies in for off-day Alonso. Priority 2: Monitor Bellinger's back tightness before setting Sunday's lineup.",
  },

  // ── Rankings ────────────────────────────────────────────────────────────
  rankings: {
    pos_type: "B",
    count: 15,
    source: "z-score",
    players: [
      { rank: 1, name: "Shohei Ohtani", team: "LAD", position: "DH", z_score: 3.12, mlb_id: 660271 },
      { rank: 2, name: "Aaron Judge", team: "NYY", position: "OF", z_score: 2.87, mlb_id: 592450 },
      { rank: 3, name: "Mookie Betts", team: "LAD", position: "SS,OF", z_score: 2.65, mlb_id: 605141 },
      { rank: 4, name: "Ronald Acuna Jr.", team: "ATL", position: "OF", z_score: 2.51, mlb_id: 660670 },
      { rank: 5, name: "Juan Soto", team: "NYM", position: "OF", z_score: 2.44, mlb_id: 665742 },
      { rank: 6, name: "Freddie Freeman", team: "LAD", position: "1B", z_score: 2.38, mlb_id: 518692 },
      { rank: 7, name: "Vladimir Guerrero Jr.", team: "TOR", position: "1B", z_score: 2.34, mlb_id: 665489 },
      { rank: 8, name: "Bobby Witt Jr.", team: "KC", position: "SS", z_score: 2.18, mlb_id: 677951 },
      { rank: 9, name: "Trea Turner", team: "PHI", position: "SS", z_score: 2.05, mlb_id: 607208 },
      { rank: 10, name: "Corey Seager", team: "TEX", position: "SS", z_score: 1.85, mlb_id: 608369 },
      { rank: 11, name: "Rafael Devers", team: "BOS", position: "3B", z_score: 1.72, mlb_id: 646240 },
      { rank: 12, name: "Gunnar Henderson", team: "BAL", position: "SS,3B", z_score: 1.65, mlb_id: 683002 },
      { rank: 13, name: "Marcus Semien", team: "TEX", position: "2B", z_score: 1.21, mlb_id: 543760 },
      { rank: 14, name: "Pete Alonso", team: "NYM", position: "1B", z_score: 0.94, mlb_id: 624413 },
      { rank: 15, name: "Julio Rodriguez", team: "SEA", position: "OF", z_score: 0.81, mlb_id: 677594 },
    ],
    ai_recommendation: "Best value still available: Shohei Ohtani (z-score 3.12). If you can trade for him, he's the #1 overall player by a wide margin.",
  },

  // ── Player Comparison ───────────────────────────────────────────────────
  compare: {
    player1: {
      name: "Aaron Judge",
      mlb_id: 592450,
      z_score: 2.87,
      categories: { R: 2.1, H: 1.4, HR: 3.8, RBI: 2.9, K: -1.2, TB: 3.1, AVG: 0.8, OBP: 1.5, XBH: 3.2, NSB: -0.5 },
    },
    player2: {
      name: "Bobby Witt Jr.",
      mlb_id: 677951,
      z_score: 2.18,
      categories: { R: 2.5, H: 2.2, HR: 1.6, RBI: 1.8, K: 0.3, TB: 2.0, AVG: 1.9, OBP: 1.2, XBH: 1.5, NSB: 3.1 },
    },
    ai_recommendation: "Judge wins on raw power (HR +2.2, TB +1.1, XBH +1.7) but Witt Jr. wins on speed and contact (NSB +3.6, AVG +1.1, H +0.8). Pick Judge for power cats, Witt for balanced builds.",
  },

  // ── Player Value ────────────────────────────────────────────────────────
  value: {
    name: "Aaron Judge",
    mlb_id: 592450,
    team: "NYY",
    pos: "OF",
    player_type: "hitter",
    z_final: 2.87,
    categories: [
      { category: "R", z_score: 2.1, raw_stat: 112 },
      { category: "H", z_score: 1.4, raw_stat: 148 },
      { category: "HR", z_score: 3.8, raw_stat: 45 },
      { category: "RBI", z_score: 2.9, raw_stat: 108 },
      { category: "K", z_score: -1.2, raw_stat: 142 },
      { category: "TB", z_score: 3.1, raw_stat: 302 },
      { category: "AVG", z_score: 0.8, raw_stat: 0.31 },
      { category: "OBP", z_score: 1.5, raw_stat: 0.41 },
      { category: "XBH", z_score: 3.2, raw_stat: 62 },
      { category: "NSB", z_score: -0.5, raw_stat: 3 },
    ],
    ai_recommendation: "ELITE — Judge's z-score of 2.87 is top-3 overall. Monster power categories (HR 3.8, TB 3.1, XBH 3.2) but K drag (-1.2) and no speed (-0.5) limit his floor. Untouchable in power builds.",
  },

  // ── Action Results ──────────────────────────────────────────────────────
  "action-add": {
    type: "add",
    success: true,
    message: "Successfully added Esteury Ruiz to your roster.",
    player_id: "682650",
    ai_recommendation: "Esteury Ruiz added successfully. His elite speed should boost your NSB category immediately. Slot him in an OF or UTIL spot for today's game.",
  },

  "action-drop": {
    type: "drop",
    success: true,
    message: "Successfully dropped Tommy Edman from your roster.",
    player_id: "669023",
    ai_recommendation: "Tommy Edman dropped. He was trending down (-8.7% ownership). Good move to clear the roster spot for a higher-impact player.",
  },

  "action-swap": {
    type: "swap",
    success: true,
    message: "Successfully added Esteury Ruiz and dropped Tommy Edman.",
    add_id: "682650",
    drop_id: "669023",
    ai_recommendation: "Swap complete: Ruiz in, Edman out. This directly upgrades your speed and NSB production. Check the waiver wire for pitching adds with your remaining moves.",
  },

  // ── Category Simulate ──────────────────────────────────────────────────
  "category-simulate": {
    type: "category-simulate",
    add_player: { name: "Jazz Chisholm Jr.", team: "NYY", positions: "2B,3B,OF", mlb_id: 665862 },
    drop_player: { name: "Brendan Donovan", team: "STL", positions: "2B,3B,OF", mlb_id: 680977 },
    current_ranks: [
      { name: "R", rank: 4, total: 12 },
      { name: "H", rank: 6, total: 12 },
      { name: "HR", rank: 8, total: 12 },
      { name: "RBI", rank: 7, total: 12 },
      { name: "TB", rank: 5, total: 12 },
      { name: "AVG", rank: 9, total: 12 },
      { name: "OBP", rank: 8, total: 12 },
      { name: "NSB", rank: 3, total: 12 },
      { name: "XBH", rank: 6, total: 12 },
      { name: "K", rank: 5, total: 12 },
    ],
    simulated_ranks: [
      { name: "R", rank: 3, total: 12, change: 1 },
      { name: "H", rank: 6, total: 12, change: 0 },
      { name: "HR", rank: 6, total: 12, change: 2 },
      { name: "RBI", rank: 6, total: 12, change: 1 },
      { name: "TB", rank: 4, total: 12, change: 1 },
      { name: "AVG", rank: 10, total: 12, change: -1 },
      { name: "OBP", rank: 9, total: 12, change: -1 },
      { name: "NSB", rank: 2, total: 12, change: 1 },
      { name: "XBH", rank: 5, total: 12, change: 1 },
      { name: "K", rank: 6, total: 12, change: -1 },
    ],
    summary: "Adding Jazz Chisholm Jr. projects to improve HR (+2), NSB (+1), R (+1), RBI (+1), TB (+1), XBH (+1) but may hurt AVG (-1), OBP (-1), K (-1). Net: +4 rank improvement across categories.",
    ai_recommendation: "Adding Jazz Chisholm Jr. is a net positive: +4 rank improvement across categories. You gain HR, NSB, and R but sacrifice some AVG and OBP. Worth it given your speed weakness.",
  },

  // ── Scout Opponent ─────────────────────────────────────────────────────
  "scout-opponent": {
    type: "scout-opponent",
    week: 4,
    opponent: "Team Fernandez",
    score: { wins: 8, losses: 9, ties: 3 },
    categories: [
      { name: "R", my_value: "42", opp_value: "38", result: "win", margin: "comfortable" },
      { name: "H", my_value: "78", opp_value: "76", result: "win", margin: "close" },
      { name: "HR", my_value: "8", opp_value: "12", result: "loss", margin: "comfortable" },
      { name: "RBI", my_value: "35", opp_value: "41", result: "loss", margin: "close" },
      { name: "K_bat", my_value: "52", opp_value: "58", result: "win", margin: "close" },
      { name: "TB", my_value: "120", opp_value: "118", result: "win", margin: "close" },
      { name: "AVG", my_value: ".271", opp_value: ".265", result: "win", margin: "close" },
      { name: "OBP", my_value: ".338", opp_value: ".342", result: "loss", margin: "close" },
      { name: "XBH", my_value: "22", opp_value: "25", result: "loss", margin: "close" },
      { name: "NSB", my_value: "5", opp_value: "3", result: "win", margin: "comfortable" },
      { name: "IP", my_value: "38.2", opp_value: "35.1", result: "win", margin: "comfortable" },
      { name: "W", my_value: "3", opp_value: "4", result: "loss", margin: "close" },
      { name: "L", my_value: "2", opp_value: "3", result: "win", margin: "close" },
      { name: "ER", my_value: "14", opp_value: "12", result: "loss", margin: "close" },
      { name: "K_pitch", my_value: "42", opp_value: "38", result: "win", margin: "comfortable" },
      { name: "HLD", my_value: "4", opp_value: "2", result: "win", margin: "comfortable" },
      { name: "ERA", my_value: "3.26", opp_value: "3.06", result: "loss", margin: "close" },
      { name: "WHIP", my_value: "1.18", opp_value: "1.22", result: "win", margin: "close" },
      { name: "QS", my_value: "2", opp_value: "3", result: "loss", margin: "close" },
      { name: "NSV", my_value: "3", opp_value: "1", result: "win", margin: "comfortable" },
    ],
    opp_strengths: ["HR", "RBI", "QS"],
    opp_weaknesses: ["NSB", "K_pitch", "NSV", "HLD"],
    strategy: [
      "Target close categories: RBI (-6), OBP (-.004), XBH (-3), ERA (-0.20) are all within reach",
      "Protect your leads: H (+2), TB (+2), AVG (+.006), WHIP (-.04) are close - don't get complacent",
      "Stream pitchers to win W and QS - opponent has edge but it's close",
      "Your opponent is strong in power (HR, RBI) - hard to overcome, focus elsewhere",
      "Leverage your reliever advantage (HLD, NSV) - consider streaming a closer",
    ],
    ai_recommendation: "Opponent is weak in NSB, K-pitch, NSV, and HLD. Exploit with speed adds and reliever streaming. Avoid trying to beat them in HR and RBI — they're too strong there.",
  },

  // ── Matchup Strategy ─────────────────────────────────────────────────────
  "matchup-strategy": {
    type: "matchup-strategy",
    week: 7,
    opponent: "Big Poppa Pump",
    score: { wins: 10, losses: 8, ties: 2 },
    schedule: {
      my_batter_games: 42,
      my_pitcher_games: 35,
      opp_batter_games: 38,
      opp_pitcher_games: 32,
      advantage: "you",
    },
    categories: [
      { name: "R", my_value: "42", opp_value: "38", result: "win", margin: "comfortable", classification: "lock", reason: "Comfortable lead — maintain" },
      { name: "H", my_value: "78", opp_value: "76", result: "win", margin: "close", classification: "protect", reason: "Close — stay alert and don't sacrifice this lead" },
      { name: "HR", my_value: "8", opp_value: "10", result: "loss", margin: "close", classification: "target", reason: "Close and you have +4 batter games" },
      { name: "RBI", my_value: "35", opp_value: "38", result: "loss", margin: "close", classification: "target", reason: "Close — winnable with waiver moves" },
      { name: "K_bat", my_value: "52", opp_value: "58", result: "win", margin: "close", classification: "protect", reason: "Close — stay alert and don't sacrifice this lead" },
      { name: "TB", my_value: "120", opp_value: "108", result: "win", margin: "comfortable", classification: "lock", reason: "Comfortable lead — maintain" },
      { name: "AVG", my_value: ".271", opp_value: ".265", result: "win", margin: "close", classification: "protect", reason: "Close — stay alert and don't sacrifice this lead" },
      { name: "OBP", my_value: ".338", opp_value: ".342", result: "loss", margin: "close", classification: "target", reason: "Close — winnable with waiver moves" },
      { name: "XBH", my_value: "22", opp_value: "25", result: "loss", margin: "close", classification: "target", reason: "Close and you have +4 batter games" },
      { name: "NSB", my_value: "5", opp_value: "3", result: "win", margin: "comfortable", classification: "lock", reason: "Comfortable lead — maintain" },
      { name: "IP", my_value: "38.2", opp_value: "35.1", result: "win", margin: "comfortable", classification: "lock", reason: "Comfortable lead — maintain" },
      { name: "W", my_value: "3", opp_value: "5", result: "loss", margin: "comfortable", classification: "concede", reason: "Comfortable opponent lead — focus elsewhere" },
      { name: "L", my_value: "2", opp_value: "3", result: "win", margin: "close", classification: "protect", reason: "Close — stay alert and don't sacrifice this lead" },
      { name: "ER", my_value: "14", opp_value: "12", result: "loss", margin: "close", classification: "target", reason: "Close — winnable with quality starts" },
      { name: "K_pitch", my_value: "42", opp_value: "38", result: "win", margin: "comfortable", classification: "lock", reason: "Comfortable lead — maintain" },
      { name: "HLD", my_value: "4", opp_value: "2", result: "win", margin: "comfortable", classification: "lock", reason: "Comfortable lead — maintain" },
      { name: "ERA", my_value: "3.26", opp_value: "3.06", result: "loss", margin: "close", classification: "target", reason: "Close — winnable with quality starts" },
      { name: "WHIP", my_value: "1.18", opp_value: "1.22", result: "win", margin: "close", classification: "protect", reason: "Close — stay alert and don't sacrifice this lead" },
      { name: "QS", my_value: "2", opp_value: "4", result: "loss", margin: "comfortable", classification: "concede", reason: "Comfortable opponent lead — focus elsewhere" },
      { name: "NSV", my_value: "3", opp_value: "1", result: "win", margin: "comfortable", classification: "lock", reason: "Dominant lead — locked in" },
    ],
    opp_transactions: [
      { type: "add", player: "Tyler Glasnow", date: "2026-06-15" },
      { type: "drop", player: "MacKenzie Gore", date: "2026-06-15" },
      { type: "add", player: "Royce Lewis", date: "2026-06-13" },
    ],
    strategy: {
      target: ["HR", "RBI", "OBP", "XBH", "ER", "ERA"],
      protect: ["H", "K_bat", "AVG", "L", "WHIP"],
      concede: ["W", "QS"],
      lock: ["R", "TB", "NSB", "IP", "K_pitch", "HLD", "NSV"],
    },
    waiver_targets: [
      { name: "Wyatt Langford", pid: "700530", pct: 42, categories: ["HR", "RBI", "XBH"], team: "Rangers", games: 5, mlb_id: 700530 },
      { name: "Lars Nootbaar", pid: "663457", pct: 38, categories: ["OBP", "R"], team: "Cardinals", games: 6, mlb_id: 663457 },
      { name: "Bo Naylor", pid: "666310", pct: 29, categories: ["HR", "RBI"], team: "Guardians", games: 5, mlb_id: 666310 },
      { name: "Nick Lodolo", pid: "666157", pct: 35, categories: ["ERA", "ER"], team: "Reds", games: 4, mlb_id: 666157 },
      { name: "Bryce Miller", pid: "682247", pct: 55, categories: ["ERA", "ER", "K_pitch"], team: "Mariners", games: 5, mlb_id: 682247 },
    ],
    summary: "Winning 10-8-2 with a schedule edge (+7 batter games). Target HR, RBI, OBP, XBH, ER, ERA — all within reach. Protect H, AVG, WHIP leads. Concede W, QS where opponent is dominant.",
    ai_recommendation: "Winning 10-8-2 with a +7 batter game edge. Flip HR and RBI by adding a power bat. Protect your close leads in H, AVG, and WHIP — don't make risky moves that tank rate stats.",
  },

  // ── Trade Builder ────────────────────────────────────────────────────────
  "trade-builder": {
    roster: {
      players: [
        { name: "Adley Rutschman", player_id: "668939", position: "C", team: "BAL", mlb_id: 668939 },
        { name: "Pete Alonso", player_id: "624413", position: "1B", team: "NYM", mlb_id: 624413 },
        { name: "Marcus Semien", player_id: "543760", position: "2B", team: "TEX", mlb_id: 543760 },
        { name: "Bobby Witt Jr.", player_id: "677951", position: "SS", team: "KC", mlb_id: 677951 },
        { name: "Rafael Devers", player_id: "646240", position: "3B", team: "BOS", mlb_id: 646240 },
        { name: "Julio Rodriguez", player_id: "677594", position: "OF", team: "SEA", mlb_id: 677594 },
        { name: "Corbin Carroll", player_id: "682998", position: "OF", team: "ARI", mlb_id: 682998 },
        { name: "Juan Soto", player_id: "665742", position: "OF", team: "NYM", mlb_id: 665742 },
      ],
    },
    search_results: [
      { name: "Trea Turner", player_id: "607208", position: "SS", team: "PHI", mlb_id: 607208 },
      { name: "Yordan Alvarez", player_id: "670541", position: "OF", team: "HOU", mlb_id: 670541 },
      { name: "Freddie Freeman", player_id: "518692", position: "1B", team: "LAD", mlb_id: 518692 },
      { name: "Kyle Tucker", player_id: "663656", position: "OF", team: "HOU", mlb_id: 663656 },
    ],
    evaluation: null,
    ai_recommendation: "Build packages around Pete Alonso or Corbin Carroll — both are tradeable assets. Target speed (Trea Turner) or saves (Emmanuel Clase) to address your category gaps.",
  },

  // ── MLB Teams ───────────────────────────────────────────────────────────
  "mlb-teams": {
    teams: [
      { id: 109, name: "Arizona Diamondbacks", abbreviation: "ARI" },
      { id: 144, name: "Atlanta Braves", abbreviation: "ATL" },
      { id: 110, name: "Baltimore Orioles", abbreviation: "BAL" },
      { id: 111, name: "Boston Red Sox", abbreviation: "BOS" },
      { id: 112, name: "Chicago Cubs", abbreviation: "CHC" },
      { id: 113, name: "Cincinnati Reds", abbreviation: "CIN" },
      { id: 114, name: "Cleveland Guardians", abbreviation: "CLE" },
      { id: 115, name: "Colorado Rockies", abbreviation: "COL" },
      { id: 145, name: "Chicago White Sox", abbreviation: "CWS" },
      { id: 116, name: "Detroit Tigers", abbreviation: "DET" },
      { id: 117, name: "Houston Astros", abbreviation: "HOU" },
      { id: 118, name: "Kansas City Royals", abbreviation: "KC" },
      { id: 108, name: "Los Angeles Angels", abbreviation: "LAA" },
      { id: 119, name: "Los Angeles Dodgers", abbreviation: "LAD" },
      { id: 146, name: "Miami Marlins", abbreviation: "MIA" },
      { id: 158, name: "Milwaukee Brewers", abbreviation: "MIL" },
      { id: 142, name: "Minnesota Twins", abbreviation: "MIN" },
      { id: 121, name: "New York Mets", abbreviation: "NYM" },
      { id: 147, name: "New York Yankees", abbreviation: "NYY" },
      { id: 133, name: "Oakland Athletics", abbreviation: "OAK" },
      { id: 143, name: "Philadelphia Phillies", abbreviation: "PHI" },
      { id: 134, name: "Pittsburgh Pirates", abbreviation: "PIT" },
      { id: 135, name: "San Diego Padres", abbreviation: "SD" },
      { id: 136, name: "Seattle Mariners", abbreviation: "SEA" },
      { id: 137, name: "San Francisco Giants", abbreviation: "SF" },
      { id: 138, name: "St. Louis Cardinals", abbreviation: "STL" },
      { id: 139, name: "Tampa Bay Rays", abbreviation: "TB" },
      { id: 140, name: "Texas Rangers", abbreviation: "TEX" },
      { id: 141, name: "Toronto Blue Jays", abbreviation: "TOR" },
      { id: 120, name: "Washington Nationals", abbreviation: "WSH" },
    ],
  },

  // ── MLB Roster ──────────────────────────────────────────────────────────
  "mlb-roster": {
    team_name: "New York Yankees",
    players: [
      { name: "Aaron Judge", jersey_number: "99", position: "OF" },
      { name: "Gerrit Cole", jersey_number: "45", position: "SP" },
      { name: "Juan Soto", jersey_number: "22", position: "OF" },
      { name: "Jazz Chisholm Jr.", jersey_number: "13", position: "3B" },
      { name: "Anthony Volpe", jersey_number: "11", position: "SS" },
      { name: "Austin Wells", jersey_number: "28", position: "C" },
      { name: "Giancarlo Stanton", jersey_number: "27", position: "DH" },
      { name: "Carlos Rodon", jersey_number: "55", position: "SP" },
      { name: "Luke Weaver", jersey_number: "19", position: "RP" },
      { name: "Anthony Rizzo", jersey_number: "48", position: "1B" },
    ],
  },

  // ── MLB Player ──────────────────────────────────────────────────────────
  "mlb-player": {
    name: "Aaron Judge",
    position: "OF",
    team: "New York Yankees",
    bats: "R",
    throws: "R",
    age: 33,
    mlb_id: 592450,
  },

  // ── MLB Stats ───────────────────────────────────────────────────────────
  "mlb-stats": {
    player_id: "592450",
    season: "2025",
    stats: {
      G: 157,
      AB: 550,
      R: 112,
      H: 165,
      HR: 52,
      RBI: 128,
      BB: 98,
      K: 145,
      AVG: ".300",
      OBP: ".410",
      SLG: ".625",
      OPS: "1.035",
    },
  },

  // ── MLB Injuries ────────────────────────────────────────────────────────
  "mlb-injuries": {
    injuries: [
      { player: "Spencer Strider", team: "Atlanta Braves", team_id: 144, description: "60-Day IL - UCL reconstruction" },
      { player: "Shane Baz", team: "Tampa Bay Rays", team_id: 139, description: "60-Day IL - Tommy John surgery" },
      { player: "Walker Buehler", team: "Los Angeles Dodgers", team_id: 119, description: "15-Day IL - Hip inflammation" },
      { player: "Luis Severino", team: "New York Mets", team_id: 121, description: "15-Day IL - Right shoulder strain" },
      { player: "Cody Bellinger", team: "Chicago Cubs", team_id: 112, description: "DTD - Back tightness" },
      { player: "Byron Buxton", team: "Minnesota Twins", team_id: 142, description: "10-Day IL - Hip strain" },
      { player: "Max Muncy", team: "Los Angeles Dodgers", team_id: 119, description: "10-Day IL - Oblique strain" },
      { player: "Chris Sale", team: "Atlanta Braves", team_id: 144, description: "15-Day IL - Back spasms" },
    ],
  },

  // ── MLB Standings ───────────────────────────────────────────────────────
  "mlb-standings": {
    divisions: [
      {
        division: "AL East",
        teams: [
          { name: "Baltimore Orioles", wins: 95, losses: 67, games_back: "-", team_id: 110 },
          { name: "New York Yankees", wins: 91, losses: 71, games_back: "4.0", team_id: 147 },
          { name: "Tampa Bay Rays", wins: 80, losses: 82, games_back: "15.0", team_id: 139 },
          { name: "Toronto Blue Jays", wins: 76, losses: 86, games_back: "19.0", team_id: 141 },
          { name: "Boston Red Sox", wins: 75, losses: 87, games_back: "20.0", team_id: 111 },
        ],
      },
      {
        division: "AL Central",
        teams: [
          { name: "Cleveland Guardians", wins: 88, losses: 74, games_back: "-", team_id: 114 },
          { name: "Minnesota Twins", wins: 82, losses: 80, games_back: "6.0", team_id: 142 },
          { name: "Kansas City Royals", wins: 78, losses: 84, games_back: "10.0", team_id: 118 },
          { name: "Detroit Tigers", wins: 74, losses: 88, games_back: "14.0", team_id: 116 },
          { name: "Chicago White Sox", wins: 55, losses: 107, games_back: "33.0", team_id: 145 },
        ],
      },
      {
        division: "NL East",
        teams: [
          { name: "Atlanta Braves", wins: 92, losses: 70, games_back: "-", team_id: 144 },
          { name: "Philadelphia Phillies", wins: 90, losses: 72, games_back: "2.0", team_id: 143 },
          { name: "New York Mets", wins: 81, losses: 81, games_back: "11.0", team_id: 121 },
          { name: "Washington Nationals", wins: 68, losses: 94, games_back: "24.0", team_id: 120 },
          { name: "Miami Marlins", wins: 60, losses: 102, games_back: "32.0", team_id: 146 },
        ],
      },
    ],
  },

  // ── MLB Schedule ────────────────────────────────────────────────────────
  "mlb-schedule": {
    date: "2026-05-15",
    games: [
      { away: "NYY", home: "BOS", status: "7:10 PM ET", away_id: 147, home_id: 111 },
      { away: "LAD", home: "SF", status: "9:45 PM ET", away_id: 119, home_id: 137 },
      { away: "HOU", home: "SEA", status: "10:10 PM ET", away_id: 117, home_id: 136 },
      { away: "ATL", home: "NYM", status: "7:10 PM ET", away_id: 144, home_id: 121 },
      { away: "PHI", home: "MIA", status: "6:40 PM ET", away_id: 143, home_id: 146 },
      { away: "CLE", home: "MIN", status: "7:40 PM ET", away_id: 114, home_id: 142 },
      { away: "CHC", home: "STL", status: "7:45 PM ET", away_id: 112, home_id: 138 },
      { away: "SD", home: "ARI", status: "9:40 PM ET", away_id: 135, home_id: 109 },
      { away: "TEX", home: "OAK", status: "9:40 PM ET", away_id: 140, home_id: 133 },
      { away: "BAL", home: "TOR", status: "7:07 PM ET", away_id: 110, home_id: 141 },
      { away: "CIN", home: "PIT", status: "6:35 PM ET", away_id: 113, home_id: 134 },
      { away: "DET", home: "KC", status: "8:10 PM ET", away_id: 116, home_id: 118 },
    ],
  },

  // ── Intel: Player Report ──────────────────────────────────────────────
  "intel-player": {
    type: "intel-player",
    name: "Aaron Judge",
    mlb_id: 592450,
    statcast: {
      barrel_pct_rank: 99,
      avg_exit_velo: 95.2,
      ev_pct_rank: 98,
      hard_hit_rate: 58.3,
      hh_pct_rank: 97,
      xwoba: 0.418,
      xwoba_pct_rank: 99,
      xba: 0.285,
      xba_pct_rank: 92,
      sprint_speed: 27.1,
      speed_pct_rank: 55,
      whiff_rate: null,
      chase_rate: null,
      quality_tier: "elite",
    },
    trends: {
      last_14_days: { avg: ".340", hr: 4, rbi: 11, ops: "1.120", sb: 0 },
      last_30_days: { avg: ".298", hr: 7, rbi: 19, ops: ".980", sb: 1 },
      vs_last_year: "+12% barrel rate, +3% EV",
      hot_cold: "hot",
    },
    context: {
      reddit_mentions: 8,
      reddit_sentiment: "positive",
      recent_headlines: [
        "Judge homers twice in win over Red Sox",
        "Is Judge having the best power season since Bonds?",
        "Judge xwOBA ranks #1 among all hitters",
      ],
    },
    discipline: {
      bb_rate: 14.2,
      k_rate: 25.1,
      o_swing_pct: 28.5,
      z_contact_pct: 82.1,
      swstr_pct: 12.8,
    },
    ai_recommendation: "BUY — elite barrel rate (99th percentile) with xwOBA .418 (99th). Judge is performing to his Statcast profile. Top-3 player in fantasy, period.",
  },

  // ── Intel: Breakout Candidates ────────────────────────────────────────
  "intel-breakouts": {
    type: "intel-breakouts",
    pos_type: "B",
    candidates: [
      { name: "Adley Rutschman", woba: 0.302, xwoba: 0.355, diff: 0.053, pa: 245 },
      { name: "Julio Rodriguez", woba: 0.295, xwoba: 0.342, diff: 0.047, pa: 268 },
      { name: "Willy Adames", woba: 0.310, xwoba: 0.351, diff: 0.041, pa: 252 },
      { name: "Cody Bellinger", woba: 0.288, xwoba: 0.326, diff: 0.038, pa: 198 },
      { name: "Jorge Soler", woba: 0.305, xwoba: 0.340, diff: 0.035, pa: 231 },
      { name: "Anthony Santander", woba: 0.322, xwoba: 0.355, diff: 0.033, pa: 259 },
      { name: "Ozzie Albies", woba: 0.298, xwoba: 0.329, diff: 0.031, pa: 240 },
      { name: "Austin Riley", woba: 0.315, xwoba: 0.344, diff: 0.029, pa: 215 },
      { name: "Xander Bogaerts", woba: 0.282, xwoba: 0.309, diff: 0.027, pa: 188 },
      { name: "Salvador Perez", woba: 0.296, xwoba: 0.321, diff: 0.025, pa: 234 },
    ],
    ai_recommendation: "Top breakout: Adley Rutschman. xwOBA (.355) outpacing wOBA (.302) by .053 — biggest gap on the list. His bat is about to catch up to his contact quality. Buy low now.",
  },

  // ── Intel: Bust Candidates ────────────────────────────────────────────
  "intel-busts": {
    type: "intel-busts",
    pos_type: "B",
    candidates: [
      { name: "Luis Arraez", woba: 0.365, xwoba: 0.318, diff: 0.047, pa: 275 },
      { name: "Yandy Diaz", woba: 0.348, xwoba: 0.305, diff: 0.043, pa: 248 },
      { name: "Steven Kwan", woba: 0.342, xwoba: 0.302, diff: 0.040, pa: 262 },
      { name: "Tommy Edman", woba: 0.318, xwoba: 0.282, diff: 0.036, pa: 198 },
      { name: "Josh Smith", woba: 0.325, xwoba: 0.292, diff: 0.033, pa: 212 },
      { name: "Ha-Seong Kim", woba: 0.308, xwoba: 0.278, diff: 0.030, pa: 228 },
      { name: "Brendan Donovan", woba: 0.312, xwoba: 0.284, diff: 0.028, pa: 205 },
      { name: "Alex Verdugo", woba: 0.298, xwoba: 0.272, diff: 0.026, pa: 242 },
    ],
    ai_recommendation: "Sell high alert: Luis Arraez. wOBA (.365) significantly outpacing xwOBA (.318). His .047 gap suggests he's been lucky — regression is coming. Move him while value is inflated.",
  },

  // ── Intel: Reddit Buzz ────────────────────────────────────────────────
  "intel-reddit": {
    type: "intel-reddit",
    posts: [
      { title: "PSA: Julio Rodriguez's exit velocity has jumped 3 mph over the last 2 weeks", score: 342, num_comments: 89, flair: "Hype" },
      { title: "Corbin Carroll owners - are we selling or holding?", score: 218, num_comments: 156, flair: "Player Discussion" },
      { title: "Spencer Strider throwing off mound, targeting June return", score: 445, num_comments: 67, flair: "Injury" },
      { title: "Weekly Anything Goes Thread - May 12, 2026", score: 82, num_comments: 1247, flair: "Weekly" },
      { title: "Esteury Ruiz has stolen 8 bases in 10 days. Time to add?", score: 187, num_comments: 92, flair: "Waiver" },
      { title: "Breakout Alert: Colt Keith quietly slashing .298/.365/.512", score: 156, num_comments: 44, flair: "Breakout" },
      { title: "Top prospect callup tracker - May 2026 edition", score: 278, num_comments: 71, flair: "Prospect" },
      { title: "Who are your sell-high targets right now?", score: 134, num_comments: 188, flair: "Trade" },
      { title: "Gerrit Cole scratched from tonight's start (undisclosed)", score: 521, num_comments: 203, flair: "Breaking News" },
      { title: "Is Josh Hader cooked? 5.40 ERA in May", score: 98, num_comments: 112, flair: "Player Discussion" },
    ],
    ai_recommendation: "Key buzz: Gerrit Cole scratched from start (521 upvotes) — monitor closely if you own him. Esteury Ruiz stealing bases at an elite clip — aligns with your NSB weakness.",
  },

  // ── Intel: Trending ───────────────────────────────────────────────────
  "intel-trending": {
    type: "intel-trending",
    posts: [
      { title: "Gerrit Cole scratched from tonight's start (undisclosed)", score: 521, num_comments: 203, flair: "Breaking News" },
      { title: "Spencer Strider throwing off mound, targeting June return", score: 445, num_comments: 67, flair: "Injury" },
      { title: "PSA: Julio Rodriguez's exit velocity has jumped 3 mph over the last 2 weeks", score: 342, num_comments: 89, flair: "Hype" },
      { title: "Top prospect callup tracker - May 2026 edition", score: 278, num_comments: 71, flair: "Prospect" },
      { title: "Corbin Carroll owners - are we selling or holding?", score: 218, num_comments: 156, flair: "Player Discussion" },
      { title: "Esteury Ruiz has stolen 8 bases in 10 days. Time to add?", score: 187, num_comments: 92, flair: "Waiver" },
    ],
    ai_recommendation: "Breaking: Cole scratched (top post). Spencer Strider targeting June return — if he's on waivers, stash now before the rush. Julio Rodriguez's EV spike is real per Statcast.",
  },

  // ── Intel: Prospect Watch ─────────────────────────────────────────────
  "intel-prospects": {
    type: "intel-prospects",
    transactions: [
      { player: "Jackson Chourio", type: "Recalled", team: "MIL", date: "2026-05-14", description: "Recalled from Triple-A Nashville" },
      { player: "Colton Cowser", type: "Recalled", team: "BAL", date: "2026-05-13", description: "Recalled from Triple-A Norfolk" },
      { player: "Kyle Manzardo", type: "Selected", team: "CLE", date: "2026-05-12", description: "Contract selected from Triple-A Columbus" },
      { player: "Chase DeLauter", type: "Recalled", team: "CLE", date: "2026-05-11", description: "Recalled from Triple-A Columbus" },
      { player: "Masyn Winn", type: "Optioned", team: "STL", date: "2026-05-10", description: "Optioned to Triple-A Memphis" },
      { player: "Dylan Crews", type: "Recalled", team: "WSH", date: "2026-05-09", description: "Recalled from Triple-A Rochester" },
      { player: "Junior Caminero", type: "Recalled", team: "TB", date: "2026-05-08", description: "Recalled from Triple-A Durham" },
    ],
    ai_recommendation: "Jackson Chourio and Colton Cowser are the must-add callups. Both have plus tools and immediate fantasy impact. Kyle Manzardo is a deeper league add at 1B.",
  },

  // ── Intel: MLB Transactions ───────────────────────────────────────────
  "intel-transactions": {
    type: "intel-transactions",
    days: 7,
    transactions: [
      { player: "Spencer Strider", type: "Activated", team: "ATL", date: "2026-05-15", description: "Activated from 60-Day IL" },
      { player: "Walker Buehler", type: "Placed on IL", team: "LAD", date: "2026-05-15", description: "Placed on 15-Day IL with hip inflammation" },
      { player: "Byron Buxton", type: "Placed on IL", team: "MIN", date: "2026-05-14", description: "Placed on 10-Day IL with hip strain" },
      { player: "Jackson Chourio", type: "Recalled", team: "MIL", date: "2026-05-14", description: "Recalled from Triple-A Nashville" },
      { player: "Max Muncy", type: "Placed on IL", team: "LAD", date: "2026-05-13", description: "Placed on 10-Day IL with oblique strain" },
      { player: "Kyle Manzardo", type: "Called Up", team: "CLE", date: "2026-05-12", description: "Contract selected from Triple-A Columbus" },
      { player: "Chris Sale", type: "Placed on IL", team: "ATL", date: "2026-05-12", description: "Placed on 15-Day IL with back spasms" },
      { player: "Kenta Maeda", type: "DFA", team: "DET", date: "2026-05-11", description: "Designated for assignment" },
      { player: "Dylan Crews", type: "Recalled", team: "WSH", date: "2026-05-09", description: "Recalled from Triple-A Rochester" },
      { player: "Luis Severino", type: "Placed on IL", team: "NYM", date: "2026-05-09", description: "Placed on 15-Day IL with right shoulder strain" },
    ],
    ai_recommendation: "Spencer Strider activated — if available, add immediately. Walker Buehler and Byron Buxton to IL create roster openings. Check if their owners dropped anyone useful.",
  },

  // ── Set Lineup ────────────────────────────────────────────────────────
  "set-lineup": {
    moves: [
      { player: "Bobby Witt Jr.", from_position: "BN", to_position: "SS", success: true },
      { player: "Juan Soto", from_position: "BN", to_position: "OF", success: true },
      { player: "Gunnar Henderson", from_position: "BN", to_position: "UTIL", success: true },
      { player: "Ozzie Albies", from_position: "BN", to_position: "2B", success: true },
      { player: "Corbin Carroll", from_position: "OF", to_position: "BN", success: true },
      { player: "Pete Alonso", from_position: "1B", to_position: "BN", success: false, message: "Cannot move player: 1B slot requires a replacement first" },
    ],
    applied: 5,
    failed: 1,
    ai_recommendation: "5 of 6 lineup moves applied successfully. Pete Alonso couldn't be moved — fill the 1B slot with another player first, then move Alonso to bench.",
  },

  // ── Pending Trades ──────────────────────────────────────────────────
  "pending-trades": {
    trades: [
      {
        transaction_key: "000.l.00000.tr.42",
        status: "pending",
        trader_team_key: "000.l.00000.t.1",
        trader_team_name: "Dynasty Destroyers",
        tradee_team_key: "000.l.00000.t.4",
        tradee_team_name: "Home Run Heroes",
        trader_players: [
          { name: "Yordan Alvarez", player_key: "123.p.10800", player_id: "670541" },
          { name: "Emmanuel Clase", player_key: "123.p.11235", player_id: "661403" },
        ],
        tradee_players: [
          { name: "Bobby Witt Jr.", player_key: "123.p.11556", player_id: "677951" },
        ],
        trade_note: "Witt Jr. would anchor my infield. Offering Alvarez + Clase for saves help.",
      },
      {
        transaction_key: "000.l.00000.tr.43",
        status: "pending",
        trader_team_key: "000.l.00000.t.4",
        trader_team_name: "Home Run Heroes",
        tradee_team_key: "000.l.00000.t.3",
        tradee_team_name: "Strikeout Kings",
        trader_players: [
          { name: "Pete Alonso", player_key: "123.p.10918", player_id: "624413" },
        ],
        tradee_players: [
          { name: "Trea Turner", player_key: "123.p.10647", player_id: "607208" },
        ],
        trade_note: "Looking to upgrade speed. Alonso for Turner straight up.",
      },
      {
        transaction_key: "000.l.00000.tr.44",
        status: "pending",
        trader_team_key: "000.l.00000.t.5",
        trader_team_name: "Big Poppa Pump",
        tradee_team_key: "000.l.00000.t.2",
        tradee_team_name: "The Lumber Yard",
        trader_players: [
          { name: "Ronald Acuna Jr.", player_key: "123.p.11044", player_id: "660670" },
        ],
        tradee_players: [
          { name: "Freddie Freeman", player_key: "123.p.9810", player_id: "518692" },
          { name: "Josh Hader", player_key: "123.p.10250", player_id: "623352" },
        ],
        trade_note: "Selling high on Acuna. Need a steady 1B and saves.",
      },
    ],
    ai_recommendation: "Incoming trade from Dynasty Destroyers: Alvarez + Clase for Witt Jr. This is a sell-low on Witt. Counter with a smaller ask — Witt Jr. is too valuable to move 1-for-2.",
  },

  // ── Trade Action ──────────────────────────────────────────────────────
  "trade-action": {
    action: "proposed",
    success: true,
    message: "Trade proposal sent to Strikeout Kings. Pete Alonso for Trea Turner. They have 48 hours to respond.",
    trade_details: "You send: Pete Alonso (1B). You receive: Trea Turner (SS).",
    ai_recommendation: "Trade proposed to Strikeout Kings. Alonso for Turner is a speed-for-power swap — good move given your NSB weakness. Expect a counter within 24 hours.",
  },

  // ── What's New ────────────────────────────────────────────────────────
  "whats-new": {
    last_check: "2026-05-14T18:30:00Z",
    check_time: "2026-05-15T09:15:00Z",
    injuries: [
      { name: "Cody Bellinger", status: "DTD", position: "OF,1B", section: "your_team" },
      { name: "Walker Buehler", status: "15-Day IL", position: "SP", section: "league" },
      { name: "Byron Buxton", status: "10-Day IL", position: "OF", section: "league" },
      { name: "Max Muncy", status: "10-Day IL", position: "1B", section: "league" },
      { name: "Chris Sale", status: "15-Day IL", position: "SP", section: "league" },
    ],
    pending_trades: [
      { transaction_key: "000.l.00000.tr.42", trader_team_name: "Dynasty Destroyers", tradee_team_name: "Home Run Heroes" },
    ],
    league_activity: [
      { type: "add", player: "Logan Webb", team: "Big Poppa Pump" },
      { type: "add", player: "Spencer Strider", team: "Caught Stealing Hearts" },
      { type: "drop", player: "Kenta Maeda", team: "The Lumber Yard" },
      { type: "add", player: "Yainer Diaz", team: "The Lumber Yard" },
      { type: "add", player: "Josh Naylor", team: "Walk-Off Winners" },
      { type: "drop", player: "Ji-Man Choi", team: "Foul Territory" },
    ],
    trending: [
      { name: "Esteury Ruiz", direction: "up", delta: "+12.3", percent_owned: 45 },
      { name: "Colt Keith", direction: "up", delta: "+9.8", percent_owned: 55 },
      { name: "Spencer Strider", direction: "up", delta: "+8.5", percent_owned: 88 },
      { name: "Kenta Maeda", direction: "down", delta: "-11.2", percent_owned: 12 },
      { name: "Tommy Edman", direction: "down", delta: "-8.7", percent_owned: 58 },
      { name: "Jackson Chourio", direction: "up", delta: "+7.1", percent_owned: 62 },
    ],
    prospects: [
      { player: "Jackson Chourio", type: "Recalled", team: "MIL", description: "Recalled from Triple-A Nashville" },
      { player: "Kyle Manzardo", type: "Selected", team: "CLE", description: "Contract selected from Triple-A Columbus" },
      { player: "Dylan Crews", type: "Recalled", team: "WSH", description: "Recalled from Triple-A Rochester" },
      { player: "Junior Caminero", type: "Recalled", team: "TB", description: "Recalled from Triple-A Durham" },
      { player: "Colton Cowser", type: "Recalled", team: "BAL", description: "Recalled from Triple-A Norfolk" },
    ],
    ai_recommendation: "Priority 1: Handle Bellinger's DTD status — decide if he plays Sunday. Priority 2: Evaluate Dynasty Destroyers' trade offer. Priority 3: Add Esteury Ruiz before ownership spikes.",
  },

  // ── Trade Finder ──────────────────────────────────────────────────────
  "trade-finder": {
    weak_categories: ["NSB", "NSV", "IP"],
    strong_categories: ["HR", "XBH", "L"],
    partners: [
      {
        team_key: "000.l.00000.t.7",
        team_name: "Caught Stealing Hearts",
        score: 92,
        complementary_categories: ["NSB", "NSV"],
        their_hitters: [
          { name: "Trea Turner", player_id: "607208", positions: ["SS"] },
          { name: "Elly De La Cruz", player_id: "682829", positions: ["SS", "3B"] },
          { name: "Kyle Tucker", player_id: "663656", positions: ["OF"] },
          { name: "CJ Abrams", player_id: "682928", positions: ["SS"] },
          { name: "Anthony Santander", player_id: "623993", positions: ["OF", "DH"] },
        ],
        their_pitchers: [
          { name: "Ryan Helsley", player_id: "664854", positions: ["RP"] },
          { name: "Devin Williams", player_id: "642207", positions: ["RP"] },
          { name: "Ranger Suarez", player_id: "624133", positions: ["SP"] },
        ],
        packages: [
          {
            give: [{ name: "Pete Alonso", player_id: "624413", positions: ["1B"] }],
            get: [{ name: "Trea Turner", player_id: "607208", positions: ["SS"] }],
            rationale: "Upgrades NSB significantly. Turner's speed fills your biggest gap while Alonso's power fills their HR need.",
          },
          {
            give: [
              { name: "Rafael Devers", player_id: "646240", positions: ["3B"] },
              { name: "Corbin Carroll", player_id: "682998", positions: ["OF"] },
            ],
            get: [
              { name: "Elly De La Cruz", player_id: "682829", positions: ["SS", "3B"] },
              { name: "Ryan Helsley", player_id: "664854", positions: ["RP"] },
            ],
            rationale: "Addresses both NSB and NSV weaknesses in one deal. EDLC has elite speed and Helsley is a top closer.",
          },
        ],
      },
      {
        team_key: "000.l.00000.t.6",
        team_name: "Designated Drinkers",
        score: 78,
        complementary_categories: ["NSV", "IP"],
        their_hitters: [
          { name: "Freddie Freeman", player_id: "518692", positions: ["1B"] },
          { name: "Ozzie Albies", player_id: "645277", positions: ["2B"] },
          { name: "Matt Olson", player_id: "621566", positions: ["1B"] },
        ],
        their_pitchers: [
          { name: "Emmanuel Clase", player_id: "661403", positions: ["RP"] },
          { name: "Corbin Burnes", player_id: "669203", positions: ["SP"] },
          { name: "Logan Webb", player_id: "657277", positions: ["SP"] },
          { name: "Yu Darvish", player_id: "506433", positions: ["SP"] },
        ],
        packages: [
          {
            give: [{ name: "Gunnar Henderson", player_id: "683002", positions: ["SS", "3B"] }],
            get: [
              { name: "Emmanuel Clase", player_id: "661403", positions: ["RP"] },
              { name: "Corbin Burnes", player_id: "669203", positions: ["SP"] },
            ],
            rationale: "Addresses NSV and IP in one move. Henderson's value should command a closer plus ace return.",
          },
        ],
      },
      {
        team_key: "000.l.00000.t.10",
        team_name: "The Mendoza Liners",
        score: 65,
        complementary_categories: ["NSB"],
        their_hitters: [
          { name: "Jose Ramirez", player_id: "608070", positions: ["3B"] },
          { name: "Willy Adames", player_id: "642715", positions: ["SS"] },
          { name: "Jazz Chisholm Jr.", player_id: "665862", positions: ["2B", "3B", "OF"] },
        ],
        their_pitchers: [
          { name: "Sonny Gray", player_id: "543243", positions: ["SP"] },
          { name: "Bailey Ober", player_id: "641927", positions: ["SP"] },
        ],
        packages: [
          {
            give: [{ name: "Adley Rutschman", player_id: "668939", positions: ["C"] }],
            get: [{ name: "Jazz Chisholm Jr.", player_id: "665862", positions: ["2B", "3B", "OF"] }],
            rationale: "Jazz provides elite speed and positional flexibility. Rutschman is an upgrade at C for them.",
          },
        ],
      },
    ],
    ai_recommendation: "Best match: Caught Stealing Hearts (92 compatibility). They need power (your surplus) and have speed + saves (your gaps). Offer Pete Alonso for Trea Turner as a starting point.",
  },

  // ── Week Planner ──────────────────────────────────────────────────────
  "week-planner": {
    week: 7,
    start_date: "2026-05-11",
    end_date: "2026-05-17",
    dates: ["2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15", "2026-05-16", "2026-05-17"],
    players: [
      { name: "Adley Rutschman", position: "C", positions: ["C", "UTIL"], mlb_team: "BAL", total_games: 6, games_by_date: { "2026-05-11": true, "2026-05-12": true, "2026-05-13": true, "2026-05-14": false, "2026-05-15": true, "2026-05-16": true, "2026-05-17": true } },
      { name: "Pete Alonso", position: "1B", positions: ["1B", "UTIL"], mlb_team: "NYM", total_games: 5, games_by_date: { "2026-05-11": true, "2026-05-12": true, "2026-05-13": false, "2026-05-14": true, "2026-05-15": true, "2026-05-16": false, "2026-05-17": true } },
      { name: "Marcus Semien", position: "2B", positions: ["2B", "UTIL"], mlb_team: "TEX", total_games: 6, games_by_date: { "2026-05-11": true, "2026-05-12": true, "2026-05-13": true, "2026-05-14": true, "2026-05-15": true, "2026-05-16": false, "2026-05-17": true } },
      { name: "Bobby Witt Jr.", position: "SS", positions: ["SS", "3B", "UTIL"], mlb_team: "KC", total_games: 7, games_by_date: { "2026-05-11": true, "2026-05-12": true, "2026-05-13": true, "2026-05-14": true, "2026-05-15": true, "2026-05-16": true, "2026-05-17": true } },
      { name: "Rafael Devers", position: "3B", positions: ["3B", "UTIL"], mlb_team: "BOS", total_games: 6, games_by_date: { "2026-05-11": true, "2026-05-12": false, "2026-05-13": true, "2026-05-14": true, "2026-05-15": true, "2026-05-16": true, "2026-05-17": true } },
      { name: "Julio Rodriguez", position: "OF", positions: ["OF", "UTIL"], mlb_team: "SEA", total_games: 6, games_by_date: { "2026-05-11": true, "2026-05-12": true, "2026-05-13": true, "2026-05-14": true, "2026-05-15": true, "2026-05-16": true, "2026-05-17": false } },
      { name: "Juan Soto", position: "OF", positions: ["OF", "UTIL"], mlb_team: "NYM", total_games: 5, games_by_date: { "2026-05-11": true, "2026-05-12": true, "2026-05-13": false, "2026-05-14": true, "2026-05-15": true, "2026-05-16": false, "2026-05-17": true } },
      { name: "Corbin Carroll", position: "OF", positions: ["OF", "UTIL"], mlb_team: "ARI", total_games: 6, games_by_date: { "2026-05-11": true, "2026-05-12": true, "2026-05-13": true, "2026-05-14": false, "2026-05-15": true, "2026-05-16": true, "2026-05-17": true } },
    ],
    daily_totals: { "2026-05-11": 8, "2026-05-12": 7, "2026-05-13": 6, "2026-05-14": 6, "2026-05-15": 8, "2026-05-16": 5, "2026-05-17": 7 },
    ai_recommendation: "Heavy days Tuesday and Thursday (8 games each). Light day Saturday (5 games). Consider a streaming add for Saturday to maximize at-bats on the light day.",
  },

  // ── Closer Monitor ────────────────────────────────────────────────────
  "closer-monitor": {
    my_closers: [
      { name: "Josh Hader", player_id: "623352", positions: ["RP"], percent_owned: 98, status: "Healthy", mlb_id: 623352, ownership: "team" },
      { name: "Gerrit Cole", player_id: "543037", positions: ["SP"], percent_owned: 99, status: "Healthy", mlb_id: 543037, ownership: "team" },
    ],
    available_closers: [
      { name: "Carlos Estevez", player_id: "608032", positions: ["RP"], percent_owned: 62, status: "Healthy", mlb_id: 608032, ownership: "freeagents" },
      { name: "Jhoan Duran", player_id: "661395", positions: ["RP"], percent_owned: 55, status: "Healthy", mlb_id: 661395, ownership: "freeagents" },
      { name: "Tanner Scott", player_id: "656945", positions: ["RP"], percent_owned: 48, status: "Healthy", mlb_id: 656945, ownership: "freeagents" },
      { name: "Robert Suarez", player_id: "660761", positions: ["RP"], percent_owned: 42, status: "Healthy", mlb_id: 660761, ownership: "freeagents" },
      { name: "Pete Fairbanks", player_id: "664126", positions: ["RP"], percent_owned: 35, status: "DTD", mlb_id: 664126, ownership: "freeagents" },
      { name: "Raisel Iglesias", player_id: "628452", positions: ["RP"], percent_owned: 68, status: "Healthy", mlb_id: 628452, ownership: "waivers" },
    ],
    saves_leaders: [
      { name: "Emmanuel Clase", saves: "18" },
      { name: "Ryan Helsley", saves: "16" },
      { name: "Josh Hader", saves: "14" },
      { name: "Devin Williams", saves: "13" },
      { name: "Raisel Iglesias", saves: "12" },
      { name: "Carlos Estevez", saves: "11" },
      { name: "Jhoan Duran", saves: "10" },
      { name: "Robert Suarez", saves: "9" },
    ],
    ai_recommendation: "You have 1 true closer (Hader, 14 saves). Add Carlos Estevez (62% owned, 11 saves) to double your saves output. Jhoan Duran (55% owned) is the backup target.",
  },

  // ── Pitcher Matchup ───────────────────────────────────────────────────
  "pitcher-matchup": {
    week: 7,
    start_date: "2026-05-11",
    end_date: "2026-05-17",
    pitchers: [
      { name: "Gerrit Cole", player_id: "543037", mlb_team: "NYY", next_start_date: "2026-05-12", opponent: "BOS", home_away: "away", opp_avg: 0.248, opp_obp: 0.318, opp_k_pct: 24.5, opp_woba: 0.312, matchup_grade: "A", two_start: true },
      { name: "Zack Wheeler", player_id: "554430", mlb_team: "PHI", next_start_date: "2026-05-11", opponent: "MIA", home_away: "home", opp_avg: 0.232, opp_obp: 0.295, opp_k_pct: 27.8, opp_woba: 0.288, matchup_grade: "A+", two_start: false },
      { name: "Corbin Burnes", player_id: "669203", mlb_team: "BAL", next_start_date: "2026-05-13", opponent: "TOR", home_away: "away", opp_avg: 0.255, opp_obp: 0.322, opp_k_pct: 22.1, opp_woba: 0.319, matchup_grade: "B+", two_start: true },
      { name: "Logan Webb", player_id: "657277", mlb_team: "SF", next_start_date: "2026-05-14", opponent: "COL", home_away: "home", opp_avg: 0.261, opp_obp: 0.312, opp_k_pct: 26.3, opp_woba: 0.305, matchup_grade: "A-", two_start: false },
      { name: "Bryce Miller", player_id: "682243", mlb_team: "SEA", next_start_date: "2026-05-12", opponent: "OAK", home_away: "home", opp_avg: 0.238, opp_obp: 0.301, opp_k_pct: 25.9, opp_woba: 0.295, matchup_grade: "A", two_start: true },
      { name: "Bailey Ober", player_id: "641927", mlb_team: "MIN", next_start_date: "2026-05-11", opponent: "DET", home_away: "home", opp_avg: 0.245, opp_obp: 0.308, opp_k_pct: 23.4, opp_woba: 0.302, matchup_grade: "B+", two_start: true },
      { name: "Gavin Stone", player_id: "681024", mlb_team: "LAD", next_start_date: "2026-05-15", opponent: "SF", home_away: "away", opp_avg: 0.252, opp_obp: 0.325, opp_k_pct: 21.8, opp_woba: 0.321, matchup_grade: "B", two_start: false },
    ],
    ai_recommendation: "Best matchup this week: Zack Wheeler vs MIA (A+ grade). Worst: Gavin Stone vs SF (B grade). Start all 2-start pitchers (Cole, Burnes, Miller, Ober) for volume.",
  },

  // ── League Pulse ──────────────────────────────────────────────────────
  "league-pulse": {
    teams: [
      { team_key: "000.l.00000.t.4", name: "Home Run Heroes", moves: 14, trades: 1, total: 15, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { team_key: "000.l.00000.t.1", name: "Dynasty Destroyers", moves: 12, trades: 2, total: 14, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { team_key: "000.l.00000.t.9", name: "Error 404: Wins Not Found", moves: 11, trades: 1, total: 12, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { team_key: "000.l.00000.t.3", name: "Strikeout Kings", moves: 10, trades: 0, total: 10, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { team_key: "000.l.00000.t.5", name: "Big Poppa Pump", moves: 9, trades: 1, total: 10, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { team_key: "000.l.00000.t.7", name: "Caught Stealing Hearts", moves: 8, trades: 1, total: 9, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { team_key: "000.l.00000.t.2", name: "The Lumber Yard", moves: 8, trades: 0, total: 8, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { team_key: "000.l.00000.t.6", name: "Designated Drinkers", moves: 6, trades: 0, total: 6, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { team_key: "000.l.00000.t.8", name: "Walk-Off Winners", moves: 5, trades: 1, total: 6, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { team_key: "000.l.00000.t.11", name: "Balk Street Boys", moves: 4, trades: 0, total: 4, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { team_key: "000.l.00000.t.10", name: "The Mendoza Liners", moves: 3, trades: 0, total: 3, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { team_key: "000.l.00000.t.12", name: "Foul Territory", moves: 2, trades: 0, total: 2, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
    ],
    ai_recommendation: "You lead the league with 15 total moves (14 adds, 1 trade). Dynasty Destroyers is close behind with 14. Stay aggressive — your activity is paying off at 4th place.",
  },

  // ── Power Rankings ────────────────────────────────────────────────────
  "power-rankings": {
    rankings: [
      { rank: 1, team_key: "000.l.00000.t.1", name: "Dynasty Destroyers", hitting_count: 10, pitching_count: 8, roster_size: 18, avg_owned_pct: 92.4, total_score: 97.2, is_my_team: false, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 2, team_key: "000.l.00000.t.3", name: "Strikeout Kings", hitting_count: 9, pitching_count: 9, roster_size: 18, avg_owned_pct: 88.1, total_score: 91.5, is_my_team: false, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 3, team_key: "000.l.00000.t.2", name: "The Lumber Yard", hitting_count: 11, pitching_count: 7, roster_size: 18, avg_owned_pct: 85.7, total_score: 87.3, is_my_team: false, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 4, team_key: "000.l.00000.t.4", name: "Home Run Heroes", hitting_count: 10, pitching_count: 7, roster_size: 17, avg_owned_pct: 83.2, total_score: 84.8, is_my_team: true, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 5, team_key: "000.l.00000.t.5", name: "Big Poppa Pump", hitting_count: 9, pitching_count: 8, roster_size: 17, avg_owned_pct: 80.5, total_score: 82.1, is_my_team: false, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 6, team_key: "000.l.00000.t.7", name: "Caught Stealing Hearts", hitting_count: 8, pitching_count: 8, roster_size: 16, avg_owned_pct: 76.3, total_score: 78.6, is_my_team: false, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 7, team_key: "000.l.00000.t.6", name: "Designated Drinkers", hitting_count: 9, pitching_count: 7, roster_size: 16, avg_owned_pct: 72.8, total_score: 74.2, is_my_team: false, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 8, team_key: "000.l.00000.t.8", name: "Walk-Off Winners", hitting_count: 8, pitching_count: 7, roster_size: 15, avg_owned_pct: 68.4, total_score: 69.5, is_my_team: false, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 9, team_key: "000.l.00000.t.9", name: "Error 404: Wins Not Found", hitting_count: 7, pitching_count: 8, roster_size: 15, avg_owned_pct: 65.1, total_score: 65.8, is_my_team: false, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 10, team_key: "000.l.00000.t.10", name: "The Mendoza Liners", hitting_count: 8, pitching_count: 6, roster_size: 14, avg_owned_pct: 58.9, total_score: 60.2, is_my_team: false, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 11, team_key: "000.l.00000.t.11", name: "Balk Street Boys", hitting_count: 7, pitching_count: 6, roster_size: 13, avg_owned_pct: 52.3, total_score: 53.7, is_my_team: false, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 12, team_key: "000.l.00000.t.12", name: "Foul Territory", hitting_count: 6, pitching_count: 5, roster_size: 11, avg_owned_pct: 44.6, total_score: 45.1, is_my_team: false, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
    ],
    ai_recommendation: "Ranked 4th by roster strength (84.8 score). Your hitting ranks 2nd in the league but pitching depth is the gap. Add a SP to climb to 3rd.",
  },

  // ── Season Pace ───────────────────────────────────────────────────────
  "season-pace": {
    current_week: 7,
    end_week: 22,
    playoff_teams: 6,
    teams: [
      { rank: 1, name: "Dynasty Destroyers", wins: 6, losses: 0, ties: 0, weeks_played: 6, remaining_weeks: 16, win_pct: 1.0, projected_wins: 22, projected_losses: 0, is_my_team: false, playoff_status: "in", magic_number: 0, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 2, name: "The Lumber Yard", wins: 5, losses: 1, ties: 0, weeks_played: 6, remaining_weeks: 16, win_pct: 0.833, projected_wins: 18, projected_losses: 4, is_my_team: false, playoff_status: "in", magic_number: 0, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 3, name: "Strikeout Kings", wins: 4, losses: 1, ties: 1, weeks_played: 6, remaining_weeks: 16, win_pct: 0.75, projected_wins: 17, projected_losses: 5, is_my_team: false, playoff_status: "in", magic_number: 2, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 4, name: "Home Run Heroes", wins: 4, losses: 2, ties: 0, weeks_played: 6, remaining_weeks: 16, win_pct: 0.667, projected_wins: 15, projected_losses: 7, is_my_team: true, playoff_status: "in", magic_number: 4, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 5, name: "Big Poppa Pump", wins: 3, losses: 2, ties: 1, weeks_played: 6, remaining_weeks: 16, win_pct: 0.583, projected_wins: 13, projected_losses: 9, is_my_team: false, playoff_status: "bubble", magic_number: 6, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 6, name: "Designated Drinkers", wins: 3, losses: 3, ties: 0, weeks_played: 6, remaining_weeks: 16, win_pct: 0.5, projected_wins: 11, projected_losses: 11, is_my_team: false, playoff_status: "bubble", magic_number: 8, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 7, name: "Caught Stealing Hearts", wins: 3, losses: 3, ties: 0, weeks_played: 6, remaining_weeks: 16, win_pct: 0.5, projected_wins: 11, projected_losses: 11, is_my_team: false, playoff_status: "bubble", magic_number: 8, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 8, name: "Walk-Off Winners", wins: 2, losses: 4, ties: 0, weeks_played: 6, remaining_weeks: 16, win_pct: 0.333, projected_wins: 7, projected_losses: 15, is_my_team: false, playoff_status: "out", magic_number: 12, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 9, name: "Error 404: Wins Not Found", wins: 2, losses: 4, ties: 0, weeks_played: 6, remaining_weeks: 16, win_pct: 0.333, projected_wins: 7, projected_losses: 15, is_my_team: false, playoff_status: "out", magic_number: 12, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 10, name: "The Mendoza Liners", wins: 1, losses: 4, ties: 1, weeks_played: 6, remaining_weeks: 16, win_pct: 0.25, projected_wins: 6, projected_losses: 16, is_my_team: false, playoff_status: "out", magic_number: 14, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 11, name: "Balk Street Boys", wins: 1, losses: 5, ties: 0, weeks_played: 6, remaining_weeks: 16, win_pct: 0.167, projected_wins: 4, projected_losses: 18, is_my_team: false, playoff_status: "out", magic_number: 16, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
      { rank: 12, name: "Foul Territory", wins: 0, losses: 5, ties: 1, weeks_played: 6, remaining_weeks: 16, win_pct: 0.083, projected_wins: 2, projected_losses: 20, is_my_team: false, playoff_status: "out", magic_number: 18, team_logo: "https://placehold.co/40x40/1a1a2e/white?text=T", manager_image: "https://placehold.co/40x40/374151/white?text=M" },
    ],
    ai_recommendation: "On pace for 15 wins (4th place). Magic number is 4 — win 4 more matchups to clinch a playoff spot. Lock in 2 more category wins per week to stay safe.",
  },

  // ── Category Trends ──────────────────────────────────────────────────
  "category-trends": {
    categories: [
      { name: "HR", history: [{ week: 1, value: 12, rank: 5 }, { week: 2, value: 28, rank: 4 }, { week: 3, value: 41, rank: 3 }, { week: 4, value: 56, rank: 3 }, { week: 5, value: 71, rank: 2 }, { week: 6, value: 88, rank: 2 }], current_rank: 2, best_rank: 2, worst_rank: 5, trend: "improving" },
      { name: "RBI", history: [{ week: 1, value: 30, rank: 6 }, { week: 2, value: 64, rank: 5 }, { week: 3, value: 95, rank: 5 }, { week: 4, value: 130, rank: 4 }, { week: 5, value: 162, rank: 4 }, { week: 6, value: 198, rank: 3 }], current_rank: 3, best_rank: 3, worst_rank: 6, trend: "improving" },
      { name: "R", history: [{ week: 1, value: 28, rank: 4 }, { week: 2, value: 59, rank: 4 }, { week: 3, value: 87, rank: 4 }, { week: 4, value: 118, rank: 5 }, { week: 5, value: 148, rank: 5 }, { week: 6, value: 180, rank: 5 }], current_rank: 5, best_rank: 4, worst_rank: 5, trend: "declining" },
      { name: "H", history: [{ week: 1, value: 45, rank: 7 }, { week: 2, value: 92, rank: 7 }, { week: 3, value: 138, rank: 6 }, { week: 4, value: 185, rank: 6 }, { week: 5, value: 230, rank: 6 }, { week: 6, value: 278, rank: 6 }], current_rank: 6, best_rank: 6, worst_rank: 7, trend: "stable" },
      { name: "AVG", history: [{ week: 1, value: 0.265, rank: 5 }, { week: 2, value: 0.271, rank: 4 }, { week: 3, value: 0.268, rank: 5 }, { week: 4, value: 0.272, rank: 4 }, { week: 5, value: 0.269, rank: 5 }, { week: 6, value: 0.273, rank: 4 }], current_rank: 4, best_rank: 4, worst_rank: 5, trend: "stable" },
      { name: "OBP", history: [{ week: 1, value: 0.342, rank: 3 }, { week: 2, value: 0.348, rank: 3 }, { week: 3, value: 0.345, rank: 3 }, { week: 4, value: 0.351, rank: 2 }, { week: 5, value: 0.349, rank: 3 }, { week: 6, value: 0.352, rank: 2 }], current_rank: 2, best_rank: 2, worst_rank: 3, trend: "improving" },
      { name: "TB", history: [{ week: 1, value: 68, rank: 4 }, { week: 2, value: 142, rank: 4 }, { week: 3, value: 210, rank: 4 }, { week: 4, value: 282, rank: 3 }, { week: 5, value: 350, rank: 3 }, { week: 6, value: 420, rank: 3 }], current_rank: 3, best_rank: 3, worst_rank: 4, trend: "improving" },
      { name: "XBH", history: [{ week: 1, value: 18, rank: 3 }, { week: 2, value: 38, rank: 3 }, { week: 3, value: 56, rank: 4 }, { week: 4, value: 75, rank: 4 }, { week: 5, value: 92, rank: 4 }, { week: 6, value: 112, rank: 4 }], current_rank: 4, best_rank: 3, worst_rank: 4, trend: "stable" },
      { name: "NSB", history: [{ week: 1, value: 5, rank: 8 }, { week: 2, value: 11, rank: 8 }, { week: 3, value: 18, rank: 7 }, { week: 4, value: 24, rank: 8 }, { week: 5, value: 30, rank: 8 }, { week: 6, value: 35, rank: 9 }], current_rank: 9, best_rank: 7, worst_rank: 9, trend: "declining" },
      { name: "K_negative", history: [{ week: 1, value: 42, rank: 6 }, { week: 2, value: 88, rank: 7 }, { week: 3, value: 132, rank: 7 }, { week: 4, value: 178, rank: 7 }, { week: 5, value: 220, rank: 7 }, { week: 6, value: 265, rank: 7 }], current_rank: 7, best_rank: 6, worst_rank: 7, trend: "declining" },
      { name: "ERA", history: [{ week: 1, value: 3.42, rank: 4 }, { week: 2, value: 3.55, rank: 5 }, { week: 3, value: 3.38, rank: 4 }, { week: 4, value: 3.31, rank: 3 }, { week: 5, value: 3.28, rank: 3 }, { week: 6, value: 3.24, rank: 2 }], current_rank: 2, best_rank: 2, worst_rank: 5, trend: "improving" },
      { name: "WHIP", history: [{ week: 1, value: 1.18, rank: 5 }, { week: 2, value: 1.21, rank: 6 }, { week: 3, value: 1.16, rank: 4 }, { week: 4, value: 1.14, rank: 4 }, { week: 5, value: 1.12, rank: 3 }, { week: 6, value: 1.11, rank: 3 }], current_rank: 3, best_rank: 3, worst_rank: 6, trend: "improving" },
      { name: "K", history: [{ week: 1, value: 48, rank: 3 }, { week: 2, value: 98, rank: 3 }, { week: 3, value: 152, rank: 2 }, { week: 4, value: 205, rank: 2 }, { week: 5, value: 258, rank: 2 }, { week: 6, value: 310, rank: 2 }], current_rank: 2, best_rank: 2, worst_rank: 3, trend: "improving" },
      { name: "W", history: [{ week: 1, value: 3, rank: 6 }, { week: 2, value: 6, rank: 6 }, { week: 3, value: 10, rank: 5 }, { week: 4, value: 14, rank: 5 }, { week: 5, value: 17, rank: 5 }, { week: 6, value: 21, rank: 5 }], current_rank: 5, best_rank: 5, worst_rank: 6, trend: "stable" },
      { name: "QS", history: [{ week: 1, value: 4, rank: 5 }, { week: 2, value: 9, rank: 4 }, { week: 3, value: 14, rank: 4 }, { week: 4, value: 18, rank: 4 }, { week: 5, value: 23, rank: 4 }, { week: 6, value: 28, rank: 4 }], current_rank: 4, best_rank: 4, worst_rank: 5, trend: "stable" },
      { name: "NSV", history: [{ week: 1, value: 6, rank: 3 }, { week: 2, value: 12, rank: 3 }, { week: 3, value: 17, rank: 4 }, { week: 4, value: 22, rank: 4 }, { week: 5, value: 26, rank: 5 }, { week: 6, value: 30, rank: 5 }], current_rank: 5, best_rank: 3, worst_rank: 5, trend: "declining" },
      { name: "HLD", history: [{ week: 1, value: 5, rank: 7 }, { week: 2, value: 10, rank: 7 }, { week: 3, value: 16, rank: 6 }, { week: 4, value: 21, rank: 6 }, { week: 5, value: 27, rank: 6 }, { week: 6, value: 32, rank: 6 }], current_rank: 6, best_rank: 6, worst_rank: 7, trend: "stable" },
      { name: "IP", history: [{ week: 1, value: 38, rank: 6 }, { week: 2, value: 78, rank: 6 }, { week: 3, value: 118, rank: 5 }, { week: 4, value: 160, rank: 5 }, { week: 5, value: 200, rank: 5 }, { week: 6, value: 242, rank: 5 }], current_rank: 5, best_rank: 5, worst_rank: 6, trend: "stable" },
      { name: "L_negative", history: [{ week: 1, value: 2, rank: 5 }, { week: 2, value: 4, rank: 5 }, { week: 3, value: 6, rank: 6 }, { week: 4, value: 8, rank: 6 }, { week: 5, value: 10, rank: 6 }, { week: 6, value: 12, rank: 6 }], current_rank: 6, best_rank: 5, worst_rank: 6, trend: "declining" },
      { name: "ER_negative", history: [{ week: 1, value: 15, rank: 4 }, { week: 2, value: 32, rank: 5 }, { week: 3, value: 46, rank: 4 }, { week: 4, value: 61, rank: 4 }, { week: 5, value: 76, rank: 4 }, { week: 6, value: 90, rank: 4 }], current_rank: 4, best_rank: 4, worst_rank: 5, trend: "stable" },
    ],
    ai_recommendation: "Category trends: Improving: HR, RBI, OBP, TB, ERA, WHIP, K. Declining: R, NSB, K_negative, NSV, L_negative. Focus on stabilizing speed (NSB, rank 9) and saves (NSV, rank 5 and falling).",
  },

  // ── Who Owns ──────────────────────────────────────────────────────────
  "who-owns": {
    player_key: "123.p.10918",
    ownership_type: "team",
    owner: "Home Run Heroes",
    ai_recommendation: "Pete Alonso is on your roster (Home Run Heroes). He's a tradeable asset if you need to address your speed or saves weakness.",
  },

  // ── Morning Briefing ──────────────────────────────────────────────────
  "morning-briefing": {
    action_items: [
      { priority: 1, type: "lineup", message: "Start Corbin Carroll (vs LHP)" },
      { priority: 1, type: "waiver", message: "Add Rece Hinds — 45% owned, trending up fast" },
      { priority: 2, type: "streaming", message: "Stream Gavin Stone (@ CIN)" },
      { priority: 3, type: "lineup", message: "Bench J.D. Martinez (rest day)" },
    ],
    injury: {
      injured_active: [{ name: "Julio Rodriguez", position: "OF", status: "DTD", injury_description: "Hamstring tightness", team: "SEA", mlb_id: 677594 }],
      healthy_il: [],
      injured_bench: [],
      il_proper: [{ name: "Spencer Strider", position: "SP", status: "60-Day IL", injury_description: "UCL reconstruction rehab", team: "ATL", mlb_id: 675911 }],
    },
    lineup: {
      games_today: 4,
      active_off_day: [{ name: "J.D. Martinez", position: "Util", team: "NYM" }],
      bench_playing: [{ name: "Gavin Stone", position: "SP", team: "LAD" }],
      il_players: [{ name: "Spencer Strider", position: "SP", team: "ATL" }],
      suggested_swaps: [{ bench_player: "J.D. Martinez", start_player: "Gavin Stone", position: "Util" }],
      applied: false,
    },
    matchup: {
      week: 7,
      my_team: "Home Run Heroes",
      opponent: "Dynasty Destroyers",
      score: { wins: 5, losses: 3, ties: 2 },
      categories: [
        { name: "HR", my_value: "8", opp_value: "5", result: "win" as const },
        { name: "ERA", my_value: "3.15", opp_value: "3.82", result: "win" as const },
        { name: "NSB", my_value: "1", opp_value: "4", result: "loss" as const },
      ],
    },
    strategy: {
      week: 7,
      opponent: "Dynasty Destroyers",
      score: { wins: 5, losses: 3, ties: 2 },
      categories: [
        { name: "HR", my_value: "8", opp_value: "5", result: "win" as const, classification: "lock", margin: "+3" },
        { name: "ERA", my_value: "3.15", opp_value: "3.82", result: "win" as const, classification: "protect", margin: "+0.67" },
        { name: "NSB", my_value: "1", opp_value: "4", result: "loss" as const, classification: "concede", margin: "-3" },
      ],
      opp_transactions: [{ type: "add", player: "Gavin Williams", date: "Mar 1" }],
      strategy: { target: ["RBI", "TB"], protect: ["ERA", "WHIP"], concede: ["NSB"], lock: ["HR", "OBP"] },
      waiver_targets: [
        { name: "Rece Hinds", pid: "67890", pct: 45, categories: ["HR", "TB", "RBI"], team: "CIN", games: 5 },
        { name: "Gavin Stone", pid: "22222", pct: 62, categories: ["ERA", "WHIP", "QS"], team: "LAD", games: 2 },
      ],
      summary: "Target RBI and TB this week while protecting your pitching ratios. Concede NSB — opponent has too big a lead.",
    },
    whats_new: {
      last_check: "2026-03-01",
      check_time: "7:30 AM",
      injuries: [{ name: "Julio Rodriguez", status: "DTD", position: "OF", section: "active" }],
      pending_trades: [],
      league_activity: [
        { type: "add", player: "Gavin Williams", team: "Dynasty Destroyers" },
        { type: "drop", player: "Nick Lodolo", team: "Dynasty Destroyers" },
      ],
      trending: [
        { name: "Rece Hinds", direction: "added", delta: "+12%", percent_owned: 45 },
        { name: "Gavin Stone", direction: "added", delta: "+8%", percent_owned: 62 },
      ],
      prospects: [],
    },
    waiver_batters: null,
    waiver_pitchers: null,
    edit_date: "Today 11:00 AM ET",
    ai_recommendation: "Priority today: Stream Gavin Stone for his favorable matchup, and pick up Rece Hinds before your opponent does. His power upside fills your HR gap.",
  },

  // ── Punt Advisor ──────────────────────────────────────────────────────
  "punt-advisor": {
    team_name: "Home Run Heroes",
    current_rank: 4,
    num_teams: 12,
    categories: [
      { name: "R", rank: 3, value: "287", total: 12, recommendation: "target", reasoning: "Strong, keep investing", cost_to_compete: "low", lower_is_better: false },
      { name: "HR", rank: 2, value: "78", total: 12, recommendation: "target", reasoning: "Core strength", cost_to_compete: "low", lower_is_better: false },
      { name: "NSB", rank: 9, value: "22", total: 12, recommendation: "punt", reasoning: "Too expensive to fix, low correlation with power", cost_to_compete: "high", lower_is_better: false },
      { name: "K_negative", rank: 11, value: "412", total: 12, recommendation: "punt", reasoning: "Power hitters strike out — accept it", cost_to_compete: "very high", lower_is_better: true },
      { name: "AVG", rank: 5, value: ".261", total: 12, recommendation: "hold", reasoning: "Middle of the pack, not worth chasing", cost_to_compete: "medium", lower_is_better: false },
      { name: "OBP", rank: 4, value: ".335", total: 12, recommendation: "target", reasoning: "Correlated with runs scored", cost_to_compete: "low", lower_is_better: false },
      { name: "ERA", rank: 3, value: "3.42", total: 12, recommendation: "target", reasoning: "Strong staff, protect this edge", cost_to_compete: "low", lower_is_better: true },
      { name: "NSV", rank: 8, value: "18", total: 12, recommendation: "hold", reasoning: "Can improve cheaply via closer adds", cost_to_compete: "medium", lower_is_better: false },
    ],
    punt_candidates: ["NSB", "K_negative"],
    target_categories: ["R", "HR", "OBP", "ERA"],
    correlation_warnings: ["Punting NSB may also hurt R — monitor stolen base attempts on the basepaths"],
    strategy_summary: "Lean into your power/OBP build. Punt speed (NSB) and strikeouts (K) to double down on HR, R, OBP, and pitching ratios. This frees roster spots for power bats and high-K pitchers.",
  },

  // ── Playoff Planner ───────────────────────────────────────────────────
  "playoff-planner": {
    current_rank: 4,
    playoff_cutoff: 6,
    games_back: 0,
    team_name: "Home Run Heroes",
    record: "30-18-12",
    num_teams: 12,
    category_gaps: [
      { category: "NSB", current_rank: 9, target_rank: 6, places_to_gain: 3, gap: "-14 SB", priority: "high", cost_to_compete: "2-3 speed adds" },
      { category: "NSV", current_rank: 8, target_rank: 5, places_to_gain: 3, gap: "-8 SV", priority: "medium", cost_to_compete: "1 closer add" },
      { category: "K_negative", current_rank: 11, target_rank: 8, places_to_gain: 3, gap: "-35 K", priority: "low", cost_to_compete: "roster overhaul" },
    ],
    recommended_actions: [
      { action_type: "trade", description: "Trade J.D. Martinez for a speed + saves package", impact: "+3 NSB ranks, +2 NSV ranks", priority: "high" },
      { action_type: "waiver", description: "Add Rece Hinds — speed upside with power", impact: "+1 NSB rank", priority: "medium" },
      { action_type: "hold", description: "Keep pitching staff intact — ERA/WHIP are top 3", impact: "Protect core edge", priority: "low" },
    ],
    target_categories: ["R", "HR", "OBP", "ERA", "WHIP"],
    punt_categories: ["K_negative"],
    playoff_probability: 0.82,
    summary: "You're in a playoff position at rank 4. Shore up saves with a closer add, and consider a speed trade to climb 2-3 spots in NSB. Don't chase K_negative — it's a punt category in your build.",
  },

  // ── Optimal Moves ─────────────────────────────────────────────────────
  "optimal-moves": {
    roster_z_total: 14.2,
    projected_z_after: 16.8,
    net_improvement: 2.6,
    moves: [
      { rank: 1, drop: { name: "Nick Lodolo", player_id: "12345", pos: "SP", z_score: -0.8, tier: "Weak" }, add: { name: "Rece Hinds", player_id: "67890", pos: "OF", z_score: 1.2, tier: "Strong", percent_owned: 45 }, z_improvement: 2.0, categories_gained: ["HR", "TB", "RBI"], categories_lost: ["IP", "QS"] },
      { rank: 2, drop: { name: "TBD Streamer", player_id: "11111", pos: "SP", z_score: -0.3, tier: "Weak" }, add: { name: "Gavin Stone", player_id: "22222", pos: "SP", z_score: 0.3, tier: "Solid", percent_owned: 62 }, z_improvement: 0.6, categories_gained: ["ERA", "WHIP", "QS"], categories_lost: [] },
    ],
    summary: "Two moves available: Adding Rece Hinds is the highest-impact move (+2.0 z), and streaming Gavin Stone improves pitching ratios. Combined net improvement: +2.6 z-score.",
  },

  // ── IL Stash Advisor ──────────────────────────────────────────────────
  "il-stash-advisor": {
    il_slots_used: 2,
    il_slots_total: 4,
    your_il_players: [
      { name: "Julio Rodriguez", player_id: "jr01", pos: "OF", injury: "Hamstring strain", return_date: "2026-04-28", upside: 9.2, stash_grade: "A", recommendation: "hold" },
      { name: "Spencer Strider", player_id: "ss01", pos: "SP", injury: "UCL reconstruction", return_date: "2026-06-15", upside: 8.5, stash_grade: "A", recommendation: "hold" },
    ],
    fa_stash_candidates: [
      { name: "Reese Olson", player_id: "ro01", pos: "SP", injury: "Shoulder inflammation", return_date: "2026-05-10", percent_owned: 38, upside: 6.4, stash_grade: "B", z_score: 0.8, tier: "Solid" },
      { name: "DL Hall", player_id: "dh01", pos: "SP", injury: "Knee sprain", return_date: "2026-05-05", percent_owned: 22, upside: 7.1, stash_grade: "B+", z_score: 1.1, tier: "Strong" },
    ],
    ai_recommendation: "You have 2 open IL slots. Stash DL Hall (B+ grade, back May 5) — his K upside is perfect for your build. Reese Olson is a backup option if Hall is taken.",
  },

  // ── Trash Talk ────────────────────────────────────────────────────────
  "trash-talk": {
    opponent: "Dynasty Destroyers",
    intensity: "savage",
    week: 7,
    context: { your_rank: 4, their_rank: 1, score: "11-7-2" },
    lines: [
      "Your dynasty is about to get destroyed by my Week 7 lineup.",
      "Enjoy first place while it lasts — my bats are heating up.",
      "I've got more homers this week than your whole bench has all season.",
      "Your pitching staff called — they want to know when the bleeding stops.",
    ],
    featured_line: "They call you Dynasty Destroyers, but the only thing getting destroyed this week is your ERA.",
  },

  // ── Rival History ─────────────────────────────────────────────────────
  "rival-history": {
    your_team: "Home Run Heroes",
    rivals: [
      { opponent: "Dynasty Destroyers", record: "8-12-2", wins: 8, losses: 12, ties: 2, last_result: "loss", last_week: "6", dominance: "dominated" },
      { opponent: "The Lumber Yard", record: "10-8-4", wins: 10, losses: 8, ties: 4, last_result: "win", last_week: "5", dominance: "even" },
      { opponent: "Steal Everything", record: "14-6-2", wins: 14, losses: 6, ties: 2, last_result: "win", last_week: "6", dominance: "dominant" },
      { opponent: "Ace Ventura's Pitchers", record: "9-9-4", wins: 9, losses: 9, ties: 4, last_result: "tie", last_week: "4", dominance: "even" },
      { opponent: "Waiver Wire Heroes", record: "12-8-2", wins: 12, losses: 8, ties: 2, last_result: "win", last_week: "3", dominance: "strong" },
    ],
    seasons_scanned: ["2026", "2025", "2024"],
  },

  // ── Achievements ──────────────────────────────────────────────────────
  achievements: {
    total_earned: 7,
    total_available: 15,
    team_name: "Home Run Heroes",
    record: "30-18-12",
    current_rank: 4,
    current_streak: 3,
    longest_streak: 5,
    achievements: [
      { name: "Homer Happy", description: "Lead the league in HR for 3+ weeks", earned: true, value: "4 weeks", icon: "\u{1F4A5}" },
      { name: "Iron Man", description: "Zero IL moves all season", earned: false, value: null, icon: "\u{1F9BE}" },
      { name: "Hot Streak", description: "Win 3 consecutive matchups", earned: true, value: "3 in a row", icon: "\u{1F525}" },
      { name: "Trade Master", description: "Win a trade by 5+ z-score", earned: true, value: "+6.2 z", icon: "\u{1F91D}" },
      { name: "Waiver Wizard", description: "Add 3+ players who outperform projections", earned: true, value: "4 pickups", icon: "\u{1FA84}" },
      { name: "Category King", description: "Lead the league in 5+ categories simultaneously", earned: false, value: null, icon: "\u{1F451}" },
      { name: "Comeback Kid", description: "Win a matchup after trailing through Saturday", earned: true, value: "Week 4", icon: "\u{1F4AA}" },
      { name: "Perfect Week", description: "Win all 20 categories in one week", earned: false, value: null, icon: "\u{2B50}" },
      { name: "Draft Day Genius", description: "3+ draft picks in the top 20 at their position", earned: true, value: "4 picks", icon: "\u{1F3AF}" },
      { name: "Speed Demon", description: "Lead the league in NSB for 3+ weeks", earned: false, value: null, icon: "\u{26A1}" },
      { name: "Ace Collector", description: "Roster 3+ pitchers with sub-3.00 ERA", earned: true, value: "3 aces", icon: "\u{1F3B0}" },
    ],
  },

  // ── Weekly Narrative ──────────────────────────────────────────────────
  "weekly-narrative": {
    week: 6,
    result: "win",
    score: "11-7-2",
    opponent: "Steal Everything",
    categories: [
      { name: "R", your_value: "48", opp_value: "42", result: "win" },
      { name: "HR", your_value: "14", opp_value: "8", result: "win" },
      { name: "RBI", your_value: "52", opp_value: "38", result: "win" },
      { name: "NSB", your_value: "3", opp_value: "11", result: "loss" },
      { name: "AVG", your_value: ".271", opp_value: ".258", result: "win" },
      { name: "ERA", your_value: "3.15", opp_value: "3.82", result: "win" },
      { name: "WHIP", your_value: "1.08", opp_value: "1.22", result: "win" },
      { name: "K", your_value: "68", opp_value: "71", result: "loss" },
      { name: "NSV", your_value: "4", opp_value: "6", result: "loss" },
      { name: "QS", your_value: "5", opp_value: "4", result: "win" },
    ],
    mvp_category: { name: "HR", your_value: "14", opp_value: "8" },
    weakness: { name: "NSB", your_value: "3", opp_value: "11" },
    standings_change: { from: 5, to: 4, direction: "up" },
    current_rank: 4,
    key_moves: ["Streamed Gavin Stone for a QS win", "Sat J.D. Martinez on his off day to protect AVG"],
    narrative: "A dominant 11-7-2 win over Steal Everything powered by a monster HR week (14). Your power bats carried the offense while the pitching staff held firm on ERA and WHIP. The speed gap (3 vs 11 NSB) remains the Achilles heel, but this win moves you up to 4th place heading into Week 7.",
  },

  // ── FAAB Recommend ────────────────────────────────────────────────────
  "faab-recommend": {
    player: { name: "Rece Hinds", z_final: 1.2, tier: "Strong", pos: "OF", team: "CIN", mlb_id: 700530 },
    recommended_bid: 18,
    bid_range: { low: 12, high: 24 },
    faab_remaining: 72,
    faab_after: 54,
    pct_of_budget: 18,
    reasoning: [
      "Strong power upside — 95th percentile exit velocity",
      "Only 45% owned — window closing fast",
      "Fills HR/TB need in your roster build",
      "Young player with breakout trajectory",
    ],
    category_impact: {
      HR: { add_z: 0.8, drop_z: 0.0, delta: 0.8, direction: "up" },
      TB: { add_z: 0.6, drop_z: 0.0, delta: 0.6, direction: "up" },
      RBI: { add_z: 0.4, drop_z: 0.0, delta: 0.4, direction: "up" },
      AVG: { add_z: -0.2, drop_z: 0.0, delta: -0.2, direction: "down" },
      K_negative: { add_z: -0.3, drop_z: 0.0, delta: -0.3, direction: "down" },
    },
    improving_categories: ["HR", "TB", "RBI"],
  },

  // ── Ownership Trends ──────────────────────────────────────────────────
  "ownership-trends": {
    player_name: "Rece Hinds",
    player_id: "67890",
    trend: [
      { date: "2026-04-01", pct_owned: 12 },
      { date: "2026-04-05", pct_owned: 15 },
      { date: "2026-04-08", pct_owned: 18 },
      { date: "2026-04-11", pct_owned: 22 },
      { date: "2026-04-14", pct_owned: 28 },
      { date: "2026-04-17", pct_owned: 35 },
      { date: "2026-04-20", pct_owned: 45 },
    ],
    current_pct: 45,
    direction: "rising",
    delta_7d: 10,
    delta_30d: 33,
  },

  // ── Roster Stats ──────────────────────────────────────────────────────
  "roster-stats": {
    players: [
      { name: "Pete Alonso", player_id: "pa01", position: "1B", eligible_positions: ["1B", "Util"], stats: { R: 24, H: 42, HR: 14, RBI: 38, AVG: 0.268, OBP: 0.342 } },
      { name: "Corbin Carroll", player_id: "cc01", position: "OF", eligible_positions: ["OF", "Util"], stats: { R: 32, H: 48, HR: 8, RBI: 22, AVG: 0.285, OBP: 0.365 } },
      { name: "Bobby Witt Jr.", player_id: "bw01", position: "SS", eligible_positions: ["SS", "3B", "Util"], stats: { R: 38, H: 56, HR: 10, RBI: 30, AVG: 0.302, OBP: 0.348 } },
      { name: "Zack Wheeler", player_id: "zw01", position: "SP", eligible_positions: ["SP"], stats: { IP: 52.1, W: 4, K: 58, ERA: 2.92, WHIP: 1.05, QS: 5 } },
      { name: "Emmanuel Clase", player_id: "ec01", position: "RP", eligible_positions: ["RP"], stats: { IP: 22.0, W: 2, K: 24, ERA: 1.23, WHIP: 0.82, SV: 14, HLD: 0 } },
    ],
    period: "Season",
    week: null,
  },
};
