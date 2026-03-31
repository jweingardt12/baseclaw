# BaseClaw Agent Instructions

## Commands

### Daily operations
- `yahoo_morning_briefing` — Run first. Gets full situational report.
- `yahoo_auto_lineup` — Set optimal lineup. Safe to run automatically.
- `yahoo_game_day_manager` — Pre-lock weather/injury check.
- `yahoo_roster_health_check` — Audit for IL waste, bust candidates.

### Weekly operations
- `yahoo_matchup_strategy` — Analyze this week's H2H opponent.
- `yahoo_waiver_deadline_prep` — Rank waiver claims with FAAB bids.
- `yahoo_streaming` — Find streaming pitchers for the week.
- `yahoo_weekly_digest` — End-of-week recap.

### Analysis (on-demand)
- `yahoo_trade_analysis` — Evaluate a specific trade.
- `yahoo_trade_pipeline` — Search for trade partners and packages.
- `yahoo_category_check` — See category strengths/weaknesses.
- `yahoo_scout_opponent` — Deep dive on any team's roster.
- `yahoo_compare` — Head-to-head player comparison by z-score.
- `yahoo_value` — Detailed player valuation breakdown.
- `yahoo_rankings` — Top players by z-score.

### Write operations (require ENABLE_WRITE_OPS=true)
- `yahoo_add` / `yahoo_drop` / `yahoo_swap` — Roster moves.
- `yahoo_propose_trade` — Send a trade offer.
- `yahoo_set_lineup` — Move specific players to positions.
- `yahoo_waiver_claim` — Submit a waiver claim with optional FAAB bid.

## Decision tiers

### Auto-execute (safe, routine)
- Set daily lineup (bench off-day players, start active ones)
- Activate player from IL when healthy
- Move player to IL when injured

### Execute + report (moderate impact, clear upside)
- Top waiver claim (FAAB <= 20% of remaining budget)
- Streaming pitcher add (when dropping lowest-ranked option)

### Report + wait for approval (high impact)
- Any trade proposal
- FAAB bid > 20% of remaining budget
- Dropping a player ranked in the top 150
- Any move the user hasn't discussed

## Operational rules

1. **Always call `yahoo_league_context` once per session** to learn
   the league's scoring format, stat categories, and roster rules.
   Never assume standard 5x5 — the league might use custom categories.

2. **Check regression scores before any add/drop/trade.** Buy-low
   signals prevent panic-dropping slumping stars. Sell-high signals
   maximize trade value.

3. **Adapt strategy to season phase:**
   - Pre-season/draft: Focus on draft value and sleepers
   - Early season (weeks 1-4): Small sample, trust projections
   - Midseason (weeks 5-16): Blend projections with actual performance
   - Stretch run (weeks 17-22): Win-now moves, trade futures for present
   - Playoffs: Maximum optimization, stream aggressively

4. **FAAB budget pacing:** Spend ~60% in first half, ~40% in second half.
   Never spend more than 30% on a single player unless they're elite.

5. **Trade intelligence:**
   - Surplus value > 0 means the trade favors you
   - Category fit matters more than raw value
   - 2-for-1 trades consolidate value (good for the side getting 1)
   - Catcher scarcity premium is real
   - Never help teams within 2 standings positions of you

6. **Qualitative checks (automated by the intelligence layer):**
   All recommendation engines (waivers, trades, streaming, lineup, FAAB)
   automatically incorporate news context, injury severity, availability
   status, depth chart position, and BvP matchup history into scoring.
   Players who are DFA'd, released, or in the minors are filtered out.
   Injury severity applies proportional score penalties. You don't need
   to manually check these — they're baked into every z-score adjustment.
   - DEALBREAKER (DFA, released, season-ending): automatically excluded
   - SEVERE injury: z-score reduced 90%
   - MODERATE injury: z-score reduced 50%
   - WARNING (IL, DTD, role loss): z-score reduced 40%
   - Regression: buy-low (score > 15) or sell-high (score < -15)

7. **Statcast decision rules:**
   - xwOBA vs wOBA gap >= .030: strong regression signal
   - ERA vs SIERA gap >= 1.0: pitcher over/underperforming
   - Stuff+ > 110: elite pitch quality, trust over small-sample ERA
   - Barrel rate explains 73% of HR/FB variance

8. **Use workflow tools for token efficiency:**
   - `yahoo_morning_briefing` replaces 7+ individual tool calls
   - `yahoo_league_landscape` replaces 6+ individual tool calls
   - Don't call individual tools when a workflow covers the same data

9. **Competitive analysis (use `yahoo_competitor_tracker` weekly):**
   - **Direct rivals** (within 2 standings positions) are the priority.
     Every add/drop they make is a strategic signal. If they add a
     player who improves a category you're competing on, flag it.
   - **Exploit rival injuries.** When a rival loses a star to IL,
     identify which categories they're now weak in. If you're close
     in those categories, push to take the lead while they're weakened.
   - **Counter rival improvements.** When a rival adds a high-z player,
     check if you need to respond (add a counter in the same category)
     or if you can afford to ignore it.
   - **Track the trade market.** Teams in last place sell. Teams in
     playoff position buy. Identify sellers early (losing record +
     dropping good players) and target their best assets via trade.
   - **Sniped targets matter.** When a player you were watching gets
     picked up by someone else, find the next-best alternative
     immediately. Don't let one missed pickup cascade into inaction.

10. **Injury monitoring strategy:**
    - **Your roster:** The morning briefing flags injuries automatically.
      IL placements trigger immediate alerts via roster-monitor.
      SEVERE injuries require replacement; MODERATE injuries need a
      streaming fill; MINOR injuries hold and monitor.
    - **Opponent roster:** Run `yahoo_competitor_tracker` to see rival
      injuries. When a direct rival's star goes to IL, it creates a
      window to gain ground in the categories that player contributes to.
    - **Free agent injuries:** `yahoo_il_stash_advisor` identifies
      injured FAs worth stashing on IL. Players returning from injury
      with elite Statcast profiles are premium buy-low targets.
    - **Injury trends:** Players with recurring injury history (multiple
      IL stints in the same season) should be valued lower in trades
      and FAAB bids. Check context flags for injury_severity history.

11. **Watchlist discipline (use `yahoo_watchlist`):**
    - Add trade targets BEFORE you need them. When you identify a
      category need, watchlist the top 3-5 players who fill it.
    - Add sell-high candidates from your roster so you're reminded
      to shop them before regression kicks in.
    - Add trending FAs you're not ready to bid on yet. If ownership
      spikes, you'll know to act before they're gone.
    - Review the watchlist weekly. Remove resolved entries. A stale
      watchlist is worse than no watchlist.

12. **Category arms race (use `yahoo_category_arms_race`):**
    - Focus on categories where you're ranked 3rd-6th. Top 2 is
      comfortable; bottom 3 may be punt candidates. The middle
      ranks are where small moves swing standings points.
    - Track the gap to the team above you. If you're 3 HR behind
      2nd place, one good add closes that gap. If you're 30 behind,
      that category is a lost cause — punt it.
    - Monitor declining categories weekly. A category trend from
      3rd to 5th over 4 weeks means your roster has a hole that
      needs addressing via trade or waiver pickup.

## Project structure

```
baseclaw/
  mcp-apps/               # TypeScript MCP server (tools + UI)
    server.ts              # Tool registration
    main.ts                # Entry point (stdio + HTTP)
    src/tools/             # 11 tool files
  scripts/                 # Python backend (Flask API + analytics)
    api-server.py          # Flask API (~120 endpoints)
    valuations.py          # Z-score engine
    season-manager.py      # In-season strategy
    intel.py               # Statcast + analytics
  .env                     # Configuration
  docker-compose.yml       # Container setup
```

## Security boundaries

- Never expose Yahoo OAuth tokens in responses
- Never share other managers' personal information
- Never manipulate league settings or commissioner tools
- Write operations require explicit ENABLE_WRITE_OPS=true

## Autonomy levels

Set via `AGENT_AUTONOMY` in `.env`:

| Level | Behavior |
|-------|----------|
| `semi-auto` (default) | Sets lineups and manages IL automatically. Recommends trades, waivers, and FAAB bids for approval. |
| `full-auto` | Executes all recommendations automatically and reports what it did. |
| `manual` | Never makes moves. Only reports recommendations. |
