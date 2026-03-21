# Task: Make BaseClaw Tools Smarter & More Contextually Aware

## Context
BaseClaw is a fantasy baseball MCP server (TypeScript tools + Python API backend). 
The tools work mechanically but lack contextual intelligence. We identified these issues 
during a live testing session.

## Architecture
- **TypeScript MCP tools**: `mcp-apps/src/tools/*.ts` — register MCP tools, format output
- **Python API backend**: `scripts/api-server.py` — Flask endpoints 
- **Python logic**: `scripts/valuations.py` (rankings, z-scores), `scripts/season-manager.py` (trades, waivers, lineup), `scripts/intel.py` (Statcast)
- **Insights engine**: `mcp-apps/src/insights.ts` — generates AI recommendation text

## Issues to Fix (Priority Order)

### 1. Rankings `pos_type=P` returns hitters instead of pitchers
**File**: `mcp-apps/src/tools/valuations-tools.ts` (yahoo_rankings tool)
**Root cause**: The TS tool passes `pos_type` correctly, and the Python API (`api-server.py` line 384) passes it to `valuations.cmd_rankings()`. The Python code (`valuations.py` line 1296) handles `pos_type` correctly with if/else for "B" vs "P". 
**Likely issue**: The TS tool description says `pos_type: z.string().describe("B for batters, P for pitchers").default("B")` but when called via mcporter, the param might be getting passed wrong. Check the TS tool's output label — it ALWAYS says "Hitter Rankings" regardless of pos_type. Fix the label to use the actual pos_type.
**Fix**: In `valuations-tools.ts`, the label construction is `const label = pos_type === "B" ? "Hitter" : "Pitcher"` — this should work. But check if the API is actually receiving "P". Add debug logging or check if mcporter passes `type=pitchers` vs `pos_type=P`.

### 2. Trade analysis returns empty INTEL section
**File**: `mcp-apps/src/tools/workflow-tools.ts` (yahoo_trade_analysis tool, line ~269)
**Root cause**: The Python API at `/api/workflow/trade-analysis` calls `intel.cmd_player_report()` for each player, but this may be failing silently (returning `_error`). The TS tool filters out entries with `_error` in them: `const intelEntries = Object.entries(intel).filter(([, v]) => v && !("_error" in v));`
**Fix**: 
1. In the TS tool, when intel has `_error`, still show the error reason instead of hiding it completely
2. The Python intel endpoint likely fails for players who haven't played MLB games yet (pre-season). Fall back to projection-based scouting data when Statcast data isn't available.
3. Check `scripts/intel.py` `cmd_player_report()` to see why it returns errors for known players like Snell and Machado

### 3. Inconsistent z-scores between tools (rankings vs trade analysis)
**Root cause**: `valuations.cmd_rankings()` uses `load_all()` which loads from CSV projections. `season-manager.cmd_trade_eval()` calls `get_player_zscore()` which might use a different data source or apply injury adjustments.
**Fix in `scripts/valuations.py`**: 
1. Find `get_player_zscore()` and check which data source it uses
2. Ensure both paths use the same underlying projections
3. If trade eval intentionally discounts injured players, label the output clearly: "projected z-score" vs "adjusted z-score (injury-discounted)"

### 4. Category check returns empty pre-season
**File**: `scripts/season-manager.py` — `cmd_category_check()` (called by TS tool `yahoo_category_check`)
**Root cause**: The API uses real matchup data (week X stats), which is empty pre-season.
**Fix**: When `week == 0` or data is empty, fall back to projected category values from the roster's projections. Sum up each player's projected stats for each category and calculate a projected rank.

### 5. Trade finder timeout
**File**: `scripts/season-manager.py` — `cmd_trade_finder()` (line 3307)
**Root cause**: This function scans all 12 teams, evaluates multiple trade packages per team, and runs category simulations. Pre-season it may be hitting Yahoo API rate limits or doing too many lookups.
**Fix**:
1. Add a timeout parameter to the API endpoint
2. Add early returns — once you have 3 good partners, stop scanning
3. Cache roster data within a single request (don't re-fetch the same team's roster multiple times)

### 6. No positional awareness in trade suggestions (MOST IMPORTANT)
**Files**: `mcp-apps/src/tools/workflow-tools.ts` (yahoo_trade_analysis), `scripts/season-manager.py`
**Problem**: The trade analysis tool evaluates trades purely on z-score value. It doesn't check:
- Does the user already have a starter at this position?
- Would the acquired player actually start or ride the bench?
- What positions does the user actually need to fill?

**Fix — Add roster-aware trade context**:
1. In the Python `/api/workflow/trade-analysis` endpoint, also fetch the user's current roster
2. For each player being received, check:
   - What positions can they play?
   - Who currently starts at those positions?
   - Would they be an upgrade (higher z-score than current starter)?
   - Or would they be redundant (same position, lower z-score)?
3. Add a `positional_impact` section to the response:
   ```json
   {
     "positional_impact": {
       "upgrades": [{"position": "2B", "current": "Gleyber Torres (15.2z)", "new": "Jazz Chisholm (14.1z)", "upgrade": false}],
       "redundancies": [{"position": "3B", "current": "Matt Chapman (13.0z)", "blocked_by": true}],
       "new_positions": [],
       "net_starting_impact": "This player would NOT start over your current 2B."
     }
   }
   ```
4. In the TS tool, display this section prominently in the output
5. In `insights.ts`, add positional context to trade recommendations

### 7. Trade analysis should show category-level impact
**Files**: `scripts/season-manager.py` (cmd_trade_eval), `mcp-apps/src/tools/workflow-tools.ts`
**Problem**: Trade eval only shows total z-score. Doesn't show which categories improve/decline.
**Fix**: 
1. In `cmd_trade_eval`, compare per-category z-scores between give and get players
2. Add `categories_gained` and `categories_lost` arrays to the response
3. Show in the TS tool output: "Improves: SB, OBP | Hurts: HR, K"

### 8. Cron setup needs delivery target
**File**: `scripts/setup-openclaw.sh`
**Problem**: Cron jobs with `channel: "last"` fail delivery in isolated sessions because there's no prior chat context.
**Fix**: After timezone prompt, ask for delivery channel and chat ID. Pass `--channel` and `--to` flags to `openclaw cron add`.

## Commit Rules
- Make atomic commits per logical fix
- Include `Co-Authored-By: Claude <noreply@anthropic.com>` in commit messages
- Test that TypeScript compiles: `cd mcp-apps && npx tsc --noEmit`
- Test that Python syntax is valid: `python3 -c "import ast; ast.parse(open('scripts/FILE.py').read())"`

## Priority
Fix #6 (positional awareness) and #7 (category impact) first — these are the highest-impact improvements for making the platform contextually intelligent. Then fix #1-#5 and #8.
