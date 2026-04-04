# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

BaseClaw is an MCP (Model Context Protocol) server for Yahoo Fantasy Baseball. It lets AI clients (Claude Desktop, Claude Code, Cursor, etc.) manage a user's fantasy team through natural language. The system has ~130 tools spanning roster management, trades, waivers, analytics, prospects, and league intelligence.

## Architecture

Two-process Docker container with a TypeScript MCP frontend and Python analytics backend:

```
┌─ Docker container (baseclaw) ──────────────────────────┐
│                                                         │
│  entrypoint.sh starts both processes:                   │
│                                                         │
│  ┌─ Python (background) ─────────────────────────────┐  │
│  │  scripts/api-server.py  (Flask, port 8766)        │  │
│  │  ├── yahoo-fantasy.py   (Yahoo API wrapper)       │  │
│  │  ├── season-manager.py  (strategy engine, 10K+L)  │  │
│  │  ├── valuations.py      (z-score engine)          │  │
│  │  ├── intel.py           (Statcast/analytics)      │  │
│  │  ├── prospects.py       (prospect rankings)       │  │
│  │  ├── shared.py          (Yahoo OAuth, MLB API)    │  │
│  │  └── ...6 more modules                            │  │
│  └───────────────────────────────────────────────────┘  │
│                          ▲ HTTP (localhost:8766)         │
│  ┌─ Node.js (foreground) ┼───────────────────────────┐  │
│  │  mcp-apps/main.ts      (entry: stdio or HTTP)     │  │
│  │  mcp-apps/server.ts    (tool registration)        │  │
│  │  mcp-apps/src/tools/   (12 tool files, ~5700 LOC) │  │
│  │  mcp-apps/src/api/     (python-client.ts bridge)  │  │
│  │  mcp-apps/ui/          (Preact inline HTML apps)  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Exposed: port 4951 (MCP), port 8766 (Python API)      │
└─────────────────────────────────────────────────────────┘
```

**Data flow:** AI client -> MCP SDK (stdio or HTTP+OAuth) -> TypeScript tool handler -> `python-client.ts` HTTP call -> Flask API -> Yahoo Fantasy API / MLB Stats API / pybaseball.

**Transport modes:**
- **stdio** (`--stdio` flag): Used by Claude Desktop/Code via `docker exec`. No auth needed.
- **HTTP** (default): Express server on port 4951 with MCP SDK OAuth 2.1 auth. Used for remote access (e.g., claude.ai via Pangolin tunnel).

## Build & Run

```bash
# Build and start the container
docker compose up -d --build

# Rebuild after code changes (volumes mount scripts/ and config/ live)
docker compose up -d --build

# View logs
docker compose logs -f baseclaw

# Restart (picks up .env changes)
docker compose restart
```

**TypeScript MCP server (in mcp-apps/):**
```bash
cd mcp-apps
npm install
npm run build          # Full build: UI apps + preview + TypeScript
npm run build:server   # TypeScript only (tsc)
npm run build:ui       # Vite builds for inline HTML apps
npm run dev            # Dev mode with tsx (no build needed)
```

**Tests:**
```bash
cd mcp-apps
npm test               # Run all tests (vitest)
npm run test:watch     # Watch mode
npx vitest run src/tools/__tests__/server-smoke.test.ts  # Single test file
```

**Python scripts** don't have a separate build step. They run inside the container with dependencies from `requirements.txt`. To test locally:
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

**CI:** GitHub Actions builds multi-arch Docker image (amd64/arm64) on push to main, publishes to `ghcr.io/jweingardt12/baseclaw`.

## Tool Naming Convention

```
yahoo_*    → Yahoo Fantasy league operations (your team, your league)
fantasy_*  → Cross-source fantasy intelligence (news, prospects, trends)
mlb_*      → MLB reference data (teams, rosters, schedules, stats)
```

## Toolset System

Tools are organized into toolsets (defined in `mcp-apps/src/toolsets.ts`) and filtered by the `MCP_TOOLSET` env var:
- `default` profile: ~35 tools (core + lineup + waivers + trades)
- `full`: ~50+ tools
- `all`: all ~130 tools (no filtering)
- `draft-day`, `analysis`, `automation`: specialized profiles

Each tool file's `register*Tools()` function checks `shouldRegister(enabledTools, toolName)` before registering.

## Coding Conventions

**Python (scripts/):**
- String concatenation with `+`, not f-strings
- `.get()` for all dictionary access
- `try/except` with `print()` for error handling
- Each script uses a `COMMANDS` dict + `if __name__ == "__main__"` CLI dispatch
- Yahoo connection: `OAuth2(None, None, from_file=OAUTH_FILE)` -> `yfa.Game(sc, "mlb")` -> `to_league()` -> `to_team()`

**TypeScript (mcp-apps/):**
- `var` declarations (project convention, not `let`/`const`)
- String concatenation with `+`, not template literals
- Preact for UI components (aliased as React in Vite config)
- UI apps built as single-file HTML (vite-plugin-singlefile) for MCP Apps inline rendering
- `@modelcontextprotocol/ext-apps` for tool UIs with `structuredContent`
- Zod for tool parameter validation
- Path alias: `@/` maps to `ui/`

## Intelligence Layer

Every recommendation engine and player display surface flows through a unified intelligence pipeline. The central scoring function `compute_adjusted_z()` in `shared.py` combines:

- **Z-score projections** (6 systems: Steamer, ZiPS, FanGraphs DC, ATC, TheBatX, composite)
- **Statcast quality** (exit velo, barrel%, xwOBA → elite/strong/average/below/poor tier)
- **Hot/cold streaks** (recent game log trends → hot/warm/cold/ice momentum)
- **Regression signals** (buy-low/sell-high from FanGraphs career data)
- **News context** (16 RSS sources + MLB transactions → DEALBREAKER/WARNING/INFO flags)
- **Injury severity** (MINOR/MODERATE/SEVERE from news + MLB API)
- **Reddit sentiment** (r/fantasybaseball buzz → bullish/bearish)
- **Availability status** (available/minors/released/injured from MLB transactions)
- **Depth charts** (MLB API → starter/backup/bench role, probable pitcher status)
- **BvP matchup history** (career batter-vs-pitcher stats + platoon advantage)
- **Game environment** (MLB weather, HP umpire, park factor per game)
- **Consensus rankings** (FantasyPros ECR with expert disagreement signal)

Key enrichment functions in `shared.py`:
- `compute_adjusted_z(name, z, quality_tier, hot_cold, context, game_env, is_pitcher)` — central scoring with all signals
- `enrich_with_intel(players)` — batch Statcast + trends attachment
- `enrich_with_context(players)` — news flags + injuries + Reddit + availability + raw `_context` for scoring
- `attach_context(players)` — lightweight context for scoring only (no display fields)
- `prefetch_context(players)` — batch context fetch returning dict
- `is_unavailable(context)` — dealbreaker/availability check for filtering
- `get_player_profile(name)` — unified profile: z-score + intel + context + adjusted_z
- `get_game_environment(date)` — weather + HP umpire + park factor for all games on a date

Key data functions in `intel.py`:
- `get_consensus_rankings(position)` — FantasyPros ECR with rank std deviation
- `get_fangraphs_recent(stat_type, days)` — current-season FanGraphs stats via pybaseball

## Key Files

| File | Purpose |
|------|---------|
| `mcp-apps/server.ts` | Creates McpServer, registers all tool groups |
| `mcp-apps/main.ts` | Entry point — stdio vs HTTP mode, OAuth login page |
| `mcp-apps/src/toolsets.ts` | Toolset profiles, tool descriptions, filtering |
| `mcp-apps/src/api/python-client.ts` | HTTP bridge to Python API (all `apiGet`/`apiPost` calls) |
| `mcp-apps/src/api/errors.ts` | Structured error messages with fix instructions |
| `mcp-apps/src/tools/environment-tools.ts` | Game environment, umpire, consensus ranking tools |
| `scripts/api-server.py` | Flask API server (~3200 LOC, ~130 endpoints) |
| `scripts/season-manager.py` | Strategy engine (~11K LOC, largest file) |
| `scripts/valuations.py` | Z-score valuation engine (pandas/numpy) |
| `scripts/shared.py` | Yahoo OAuth, MLB API, intelligence helpers (compute_adjusted_z, enrichment) |
| `scripts/intel.py` | Statcast, bat tracking, pitch mix, depth charts, BvP, regression, consensus rankings |
| `scripts/news.py` | 16-source RSS aggregator, player context (flags, injuries, availability) |
| `scripts/prospect_news.py` | Prospect call-up probability (Bayesian signal classification) |
| `entrypoint.sh` | Container startup — generates OAuth file, starts Python bg + Node fg |
| `AGENTS.md` | Agent instructions: tool categories, decision tiers, operational rules |
| `yf` | Shell helper for CLI access to the Python API |

## Environment Variables (.env)

| Variable | Purpose |
|----------|---------|
| `YAHOO_CONSUMER_KEY` / `YAHOO_CONSUMER_SECRET` | Yahoo API OAuth credentials |
| `LEAGUE_ID` / `TEAM_ID` | Your league and team identifiers (e.g., `469.l.16960`) |
| `ENABLE_WRITE_OPS` | Enable roster moves, trades, lineup setting (default: false) |
| `MCP_TOOLSET` | Tool profile: `default`, `full`, `all`, `draft-day`, etc. |
| `MCP_SERVER_URL` | Public URL for HTTP mode OAuth |
| `MCP_AUTH_PASSWORD` | Password for HTTP mode login (8+ chars) |
| `WEBHOOK_TOKEN` | Auth token for `/hooks/wake` and `/hooks/agent` webhook endpoints |
| `ENABLE_PREVIEW` | Enable preview app at `/preview` |

## League Context

Xi Chi Psi Alumni league (ID: `469.l.16960`, Team: `469.l.16960.t.12`).

**Scoring categories:**
- Batting: R, H, HR, RBI, K (negative), TB, AVG, OBP, XBH, NSB
- Pitching: IP, W, L (negative), ER (negative), K, HLD, ERA, WHIP, QS, NSV
