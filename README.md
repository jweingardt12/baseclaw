<p align="center">
  <img src="banner.jpg" alt="BaseClaw" width="100%" />
</p>

# BaseClaw

**Your fantasy baseball team, managed by AI.**

Ask Claude about your Yahoo Fantasy Baseball league in plain English. Get instant advice on trades, lineups, waiver pickups, and strategy — powered by your actual league data.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/VgXCOg?referralCode=LLHRAk&utm_medium=integration&utm_source=template&utm_campaign=generic)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-1.0-green.svg)](https://modelcontextprotocol.io)
[![Tools](https://img.shields.io/badge/tools-130-orange.svg)](#all-tools-reference)
[![Docker](https://img.shields.io/badge/docker-required-blue.svg)](https://www.docker.com/products/docker-desktop/)
[![Yahoo Fantasy](https://img.shields.io/badge/Yahoo-Fantasy%20Baseball-7B0099.svg)](https://baseball.fantasysports.yahoo.com)

---

## What can you ask?

| Prompt | What happens |
|--------|-------------|
| "Show me my roster" | Pulls your full roster with positions, eligibility, today's games, injury flags, and intel overlays |
| "Should I accept this trade — my Soto for his Burnes and Tucker?" | Runs surplus value analysis with category fit, roster impact, and a letter grade |
| "Best pickup at SS right now" | Scores every free-agent shortstop by z-score value, category fit, and regression signals |
| "How does my team compare to the rest of the league?" | Multi-layer league intel: adjusted z-scores (projections + statcast + regression + trends), power rankings, top performers across all teams, category strengths/weaknesses, and trade fit analysis |
| "What happened overnight?" | Injuries, transactions, trending pickups, prospect call-ups, and pending trades — one shot |
| "Scout my opponent this week" | Strengths, weaknesses, streamable categories, and a game plan to beat them |

<details>
<summary><strong>30+ more prompts by category</strong></summary>

**Daily management**
- "Set my lineup for today — bench anyone without a game"
- "Who on my roster is injured? Any IL moves I should make?"
- "What are the best streaming pitchers for this week?"
- "Show me my week planner — who has off days?"
- "Check for weather risks in today's games"

**Waiver wire**
- "Who should I pick up this week to help my batting average?"
- "Best available closers on the wire"
- "Run the waiver optimizer — what's the best add/drop sequence for my team?"
- "How much FAAB should I bid on this player?"
- "Who are the most added players across Yahoo right now?"
- "Show me players on waivers that clear tomorrow"

**Trades**
- "Find me a trade partner for my excess pitching"
- "Evaluate this trade — am I giving up too much?"
- "Who on other teams would fill my HR gap?"
- "Run the full trade pipeline — find complementary deals across the league"
- "Show me my pending trade offers"

**Strategy**
- "What categories should I punt?"
- "Where do I rank in each stat category?"
- "What's my playoff probability right now?"
- "Give me a category-by-category game plan for this week's matchup"
- "Am I on pace to make the playoffs?"

**Advanced analytics**
- "Which hitters are gaining bat speed this season? Show me bat tracking breakouts"
- "Any pitchers making significant pitch mix changes?"
- "Which teams are dealing with travel fatigue today?"
- "How confident should I be in this player's projections right now?"
- "How much FAAB should I bid on this player?" *(now uses Kelly criterion math)*

**Prospect & intel**
- "Top 20 prospects closest to a call-up"
- "Deep dive on this prospect — MiLB stats, scouting grades, call-up probability"
- "Which prospects stashed on other teams are worth trading for?"
- "What's the latest news on [player]?"
- "Show me regression candidates — who's due for a correction?"
- "Full Statcast report on [player]"
- "What's Reddit saying about fantasy baseball today?"

**Season checkpoints**
- "Give me the Monday morning briefing"
- "End-of-week recap — how'd my matchup go?"
- "Monthly checkpoint — where do I stand and what should I do?"
- "Show me category trends over the last month"
- "Head-to-head record vs each manager all-time"

</details>

## Quick start (10 minutes)

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) and a [Yahoo Developer app](https://developer.yahoo.com/apps/create) with Fantasy Sports read permissions.

```bash
curl -fsSL https://raw.githubusercontent.com/jweingardt12/baseclaw/main/scripts/install.sh | bash
```

The installer pulls the Docker image, prompts for your Yahoo API credentials, starts the container, runs OAuth discovery, and configures your MCP client.

**First query:** Open Claude and ask `"Show me my roster"`. If you see your players, you're all set.

<details>
<summary><strong>Manual setup</strong></summary>

**1. Get Yahoo API credentials** — Go to [developer.yahoo.com/apps/create](https://developer.yahoo.com/apps/create), create an app with **Fantasy Sports** read permissions and `oob` as the redirect URI.

**2. Configure and run:**

```bash
git clone https://github.com/jweingardt12/baseclaw.git
cd baseclaw
cp docker-compose.example.yml docker-compose.yml
cp .env.example .env
# Edit .env — set YAHOO_CONSUMER_KEY and YAHOO_CONSUMER_SECRET
mkdir -p config data
docker compose up -d
```

**3. Discover your league** — triggers Yahoo OAuth and finds your league/team IDs:

```bash
./yf discover
```

Copy the printed `LEAGUE_ID` and `TEAM_ID` into `.env`, then `docker compose up -d` to restart.

**4. Connect to Claude** — see the next section for your AI client's config.

</details>

## Connect to your AI client

Add BaseClaw to your AI client with one JSON block. Copy the config for your client below.

<details open>
<summary><strong>Claude Desktop</strong></summary>

Edit `claude_desktop_config.json` (**macOS** `~/Library/Application Support/Claude/claude_desktop_config.json` | **Windows** `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "baseclaw": {
      "command": "docker",
      "args": ["exec", "-i", "baseclaw", "node", "/app/mcp-apps/dist/main.js", "--stdio"]
    }
  }
}
```

</details>

<details>
<summary><strong>Claude Code</strong></summary>

Add to `.mcp.json` in your project root (or `~/.claude/.mcp.json` for global):

```json
{
  "mcpServers": {
    "baseclaw": {
      "command": "docker",
      "args": ["exec", "-i", "baseclaw", "node", "/app/mcp-apps/dist/main.js", "--stdio"]
    }
  }
}
```

</details>

<details>
<summary><strong>VS Code Copilot</strong></summary>

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "baseclaw": {
      "command": "docker",
      "args": ["exec", "-i", "baseclaw", "node", "/app/mcp-apps/dist/main.js", "--stdio"]
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "baseclaw": {
      "command": "docker",
      "args": ["exec", "-i", "baseclaw", "node", "/app/mcp-apps/dist/main.js", "--stdio"]
    }
  }
}
```

> **Note:** Cursor has a 40-tool limit per MCP server. BaseClaw exposes 130 tools, so Cursor will only load the first 40. Core roster, standings, and valuation tools load first. Advanced analytics, prospect, and workflow tools may be unavailable.

</details>

<details>
<summary><strong>Cline</strong></summary>

Open Cline settings > MCP Servers > Add, then paste:

```json
{
  "mcpServers": {
    "baseclaw": {
      "command": "docker",
      "args": ["exec", "-i", "baseclaw", "node", "/app/mcp-apps/dist/main.js", "--stdio"]
    }
  }
}
```

</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "baseclaw": {
      "command": "docker",
      "args": ["exec", "-i", "baseclaw", "node", "/app/mcp-apps/dist/main.js", "--stdio"]
    }
  }
}
```

</details>

<details>
<summary><strong>Claude.ai (remote access)</strong></summary>

Claude.ai needs the server reachable over HTTPS. Set `MCP_SERVER_URL` and `MCP_AUTH_PASSWORD` in `.env`, put a reverse proxy (Caddy, nginx, Cloudflare Tunnel, Tailscale Funnel, Pangolin) in front of port 4951, and rebuild with `docker compose up -d`.

In Claude.ai: Settings > Integrations > Add MCP Server > enter `https://your-domain.com/mcp`. You'll be prompted for your password. The MCP server implements OAuth 2.1 — no third-party auth provider needed. Auth tokens persist across container restarts (stored in the mounted `config/` volume) and access tokens last 7 days with 30-day refresh tokens, so Claude.ai stays connected through deploys and resets.

</details>

## Automate with OpenClaw

Connect BaseClaw to [OpenClaw](https://github.com/openclaw/openclaw) and it runs your team autonomously. Lineups get set every morning, injuries get monitored, opponents get scouted, waiver pickups get found. You check in when you want to.

```bash
cd openclaw && bash install.sh
```

The installer copies workspace files, configures the OpenClaw Gateway, registers 8 cron jobs, installs 3 event hooks, and sets up 4 Lobster workflows with human-in-the-loop approval gates.

### What gets installed

| Component | What it does |
|-----------|-------------|
| **Workspace files** | `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `HEARTBEAT.md`, `MEMORY.md`, `USER.md` — agent persona, tool conventions, memory system |
| **Cron jobs** (8) | Morning briefing, pre-lock check, matchup plan, waiver deadline, streaming, roster audit, weekly digest, season checkpoint |
| **Lobster workflows** (4) | `waiver-claim.lobster`, `trade-proposal.lobster`, `roster-cleanup.lobster`, `morning-routine.lobster` — multi-step pipelines with approval gates |
| **Event hooks** (3) | Roster alerts (injury/trade push notifications), memory flush (persists context before compaction), health check (verifies BaseClaw on startup) |
| **Config** | `openclaw.json` (Gateway config), `mcporter.json` (MCP server registration) |

### Cron schedule

All times Eastern, configurable in `openclaw/cron/jobs.json`:

| Schedule | Task | Session | Tools called |
|----------|------|---------|-------------|
| Daily 9am | Lineup + briefing | `baseclaw-daily` | `yahoo_morning_briefing` + `yahoo_auto_lineup` |
| Daily 10:30am | Pre-lock check | `baseclaw-daily` | `yahoo_game_day_manager` |
| Monday 8am | Matchup plan | `baseclaw-weekly` | `yahoo_league_landscape` + `yahoo_matchup_strategy` |
| Tuesday 8pm | Waiver deadline prep | `baseclaw-weekly` | `yahoo_waiver_deadline_prep` |
| Thursday 9am | Streaming check | `baseclaw-daily` | `yahoo_streaming` |
| Saturday 9am | Roster audit | `baseclaw-weekly` | `yahoo_roster_health_check` |
| Sunday 9pm | Weekly digest | `baseclaw-weekly` | `yahoo_weekly_digest` |
| 1st of month 10am | Season checkpoint | `baseclaw-season` | `yahoo_season_checkpoint` |

Jobs sharing a session (`baseclaw-daily`, `baseclaw-weekly`) retain context across runs — the morning briefing knows what the pre-lock check found.

### Lobster workflows

Multi-step pipelines with human-in-the-loop approval gates. Run from chat: "run the waiver-claim workflow."

| Workflow | Steps | Approval gate |
|----------|-------|---------------|
| `waiver-claim.lobster` | Analyze waivers, rank targets with FAAB bids, approve, submit claims | Before submitting claims |
| `trade-proposal.lobster` | Scan trade pipeline, evaluate z-score impact, approve, send proposal | Before sending trade |
| `roster-cleanup.lobster` | Audit roster health, plan IL/drop moves, approve, execute changes | Before making changes |
| `morning-routine.lobster` | Run briefing, optimize lineup, summarize | None (safe operations) |

### Webhook endpoints

BaseClaw exposes OpenClaw-compatible webhook endpoints for external event triggers. Set `WEBHOOK_TOKEN` in `.env` to enable.

| Endpoint | Purpose |
|----------|---------|
| `POST /hooks/wake` | Lightweight event nudge — accepts `{text, mode}` |
| `POST /hooks/agent` | Isolated agent turn — accepts `{message, name?, sessionKey?}` |

Auth via `Authorization: Bearer <token>` or `x-openclaw-token: <token>` header. Rate-limited after 5 failed attempts.

### Autonomy levels

| Level | What it does | Best for |
|-------|-------------|----------|
| **full-auto** | Executes all recommended actions, reports after | Hands-off managers who trust the agent |
| **semi-auto** (default) | Executes safe moves (lineups, IL), recommends everything else for approval | Most users — automation with guardrails |
| **manual** | Never executes writes, only reports recommendations | Users who want full control |

Set `AGENT_AUTONOMY` in `.env`. The agent auto-detects your league configuration — FAAB vs. priority waivers, scoring format, stat categories — and skips irrelevant tools.

<details>
<summary><strong>Agent persona</strong></summary>

The `AGENTS.md` file defines the agent's identity and behavior:

- **League awareness** — Learns your format, team count, scoring categories, and roster rules on first session
- **Strategy principles** — Target close categories, concede lost causes, stream pitchers with multi-factor scoring, monitor closers, trade from surplus
- **Regression awareness** — Check regression scores before any add/drop/trade; buy-low signals prevent panic-dropping slumping stars, sell-high signals maximize trade value
- **Trade intelligence** — Surplus value analysis, category fit over raw value, consolidation premium, catcher scarcity, rival blocking (never help teams within 2 standings positions)
- **Prospect news intelligence** — Signal classification from 16 news sources with Bayesian call-up probability blending. Injury news, reassignments, and bullish reports automatically adjust stash recommendations and trade targets
- **Statcast decision rules** — Research-backed thresholds for barrel rate, exit velocity, sprint speed, xwOBA gaps, ERA vs SIERA, Stuff+, velocity changes
- **Season phases** — Early (build depth, stream aggressively), mid (trade for balance, buy low), late (playoff positioning)
- **Decision trees** — Injury response pipelines, trade search with surplus value evaluation, waiver deadline claim chains
- **FAAB management** — Kelly criterion bid sizing with posterior variance from Bayesian model, competition shading, category scarcity bonus, season phase multipliers, contender detection
- **League intelligence** — Comprehensive league intel with multi-layer power rankings (adjusted z-scores blending projections + statcast quality + regression signals + hot/cold trends), top performers across all teams with quality/regression flags, team profiles with trade fit analysis, and z-upside detection. Pre-season uses 70% z-rank + 30% quality rank; in-season shifts to 50% z-rank + 35% standings + 15% quality
- **Competitive intelligence** — Track rival activity, react to opponent moves, standings-aware trade blocking
- **Token efficiency** — Workflow tools over individual tools, concise reports

Customize `AGENTS.md` to adjust strategy, risk tolerance, or reporting style.

</details>

## How it works

BaseClaw pulls data from three sources: **Yahoo Fantasy API** (your roster, standings, matchups, free agents, transactions), **FanGraphs** (consensus projections from Steamer + ZiPS + Depth Charts), and **Baseball Savant** (Statcast metrics, Stuff+, pitch arsenal data, bat tracking). Prospect intelligence comes from MLB Stats API plus 16 news sources with Bayesian signal classification.

Player valuations use **FVARz z-scores** — volume-weighted rate stats so part-timers don't inflate rankings. Projections are park-factor adjusted and blended with live stats via **Bayesian conjugate updating** — each stat uses its own stabilization point (K-rate stabilizes at 60 PA, batting average at 400 PA), producing mathematically optimal shrinkage rates per player per stat instead of one-size-fits-all date thresholds. FAAB bidding uses **Kelly criterion** math for optimal bid sizing. Breakout detection uses **bat tracking** (bat speed, fast-swing rate, squared-up rate) and **pitch mix screening** (arsenal changes cross-referenced with effectiveness metrics). **Travel fatigue scoring** based on a peer-reviewed PNAS study of 46,535 games feeds into streaming and lineup decisions.

<details>
<summary><strong>Architecture</strong></summary>

```
┌─────────────────────────────────────────────────┐
│  Docker Container (baseclaw)                     │
│                                                 │
│  ┌──────────────────┐  ┌─────────────────────┐  │
│  │  Python API       │  │  TypeScript MCP     │  │
│  │  (Flask :8766)    │──│  (Express :4951)    │  │
│  │                   │  │                     │  │
│  │  yahoo_fantasy_api│  │  MCP SDK + ext-apps │  │
│  │  pybaseball       │  │  130 tool defs      │  │
│  │  MLB-StatsAPI     │  │  4 apps / 75 views  │  │
│  │  Playwright       │  │  11 workflow tools  │  │
│  │  CacheManager     │  │  11 tool files      │  │
│  └──────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────┘
         │                        │
    Yahoo Fantasy API        MCP Clients (stdio/HTTP)
    Yahoo Website (browser)  ├── Claude Code / Desktop
    FanGraphs (projections)  ├── Claude.ai (remote)
    Baseball Savant (intel)  ├── Agent orchestrators
                             │    (OpenClaw, cron-scheduled)
                             └── Webhooks (/hooks/wake, /hooks/agent)
```

- **Read operations**: Yahoo Fantasy OAuth API (fast, reliable)
- **Write operations**: Playwright browser automation against Yahoo Fantasy website (Yahoo's API no longer grants write scope to new developer apps)
- **Valuations**: FVARz z-scores with per-category projection blending (Steamer + ZiPS + Depth Charts), park-factor adjusted, Bayesian conjugate updating for in-season blending (per-stat stabilization points replace date-based decay), conditional catcher premium. ILP lineup optimizer (scipy) with greedy fallback. Surplus value trade analysis, Kelly criterion FAAB bidding, multi-factor streaming with Stuff+ and travel fatigue, research-backed punt viability
- **Intelligence**: Statcast data, SIERA, Stuff+/Location+/Pitching+, platoon splits, arsenal changes, bat tracking (bat speed, fast-swing rate, squared-up rate, blasts), batted ball profiles, historical comparisons, research-calibrated regression scoring (-100 to +100) with 14 signals across hitters and pitchers. Bat tracking breakout detector flags hitters gaining bat speed before stats reflect it. League-wide pitch mix screener surfaces pitchers making significant arsenal changes cross-referenced with effectiveness metrics. Travel fatigue scoring (PNAS-backed) factors timezone changes, schedule density, and eastward travel penalties into streaming and lineup decisions. Qualitative intelligence layer enriches every recommendation with injury severity, dealbreaker filtering, and context lines. Prospect news sentiment layer blends qualitative signals from 16 news sources with stat-based call-up probabilities using Bayesian updating. Cached with configurable TTL
- **MCP Apps**: Inline HTML UIs (React 19 + shadcn/ui + custom SVG charts) rendered directly in Claude via `@modelcontextprotocol/ext-apps`
- **Workflow tools**: 11 aggregated endpoints that bundle 5-7+ API calls server-side to keep tool call counts low

**Under the hood:**

1. **Yahoo Fantasy API** — Your roster, standings, matchups, free agents, transactions, and league settings come from Yahoo's OAuth API in real time. Every tool call fetches current data, not cached snapshots.

2. **Analytics engine** — Z-score valuations using the FVARz method (volume-weighted rate stats so part-timers don't inflate rankings). Projections are consensus blends (Steamer + ZiPS + Depth Charts) with per-category weighting, park-factor adjusted, and blended with live stats via **Bayesian conjugate updating** — each stat uses its own research-backed stabilization point (K-rate stabilizes at 60 PA, batting average at 400 PA, ERA at 600 BF) to produce mathematically optimal shrinkage rates per player per stat. Conditional catcher premium (2.0 for 2C leagues, 1.0 for 1C, auto-detected from league settings). ILP lineup optimizer (scipy) finds globally optimal player-to-slot assignments with greedy fallback. The engine also runs category gap analysis, research-backed punt strategy with viability ratings, matchup classification with category-specific volatility thresholds, trade evaluation with surplus value analysis (roster spot tax, category fit, consolidation premium, catcher scarcity, rival warnings), **Kelly criterion FAAB bidding** (half-Kelly with competition shading from ownership%, category scarcity bonus, posterior variance from Bayesian model), multi-factor streaming pitcher scoring (pitcher quality + park factor + opponent quality + Stuff+ + **opponent travel fatigue**), and a trade finder that scans every team for complementary deals.

3. **Player intelligence** — Every player surface pulls Statcast data (xwOBA, xERA, exit velocity, barrel rate, percentile rankings, pitch arsenal), Stuff+/Location+/Pitching+ metrics, platoon splits, historical comparisons, arsenal change detection, 7/14/30-day trend splits, FanGraphs plate discipline (SIERA, K-BB%, HR/FB%), Reddit sentiment from r/fantasybaseball, and MLB transaction alerts. A research-calibrated regression engine scores every qualified player from -100 (strong sell-high) to +100 (strong buy-low) using 6 hitter signals (xwOBA gap, career-regressed BABIP, HR/FB vs barrels, plate discipline via O-Swing%, hard-hit divergence, sprint speed) and 8 pitcher signals (ERA vs SIERA, K-BB% vs ERA, ERA vs xERA, K-rate adjusted BABIP, LOB%, HR/FB%, velocity trend, Stuff+ confidence modifier) — each with individual contribution breakdowns and confidence levels. A qualitative intelligence layer enriches every recommendation with real-world context: injury severity classification (MINOR/MODERATE/SEVERE), dealbreaker detection (DFA'd, released, suspended, or retired players auto-filtered from recommendations), and one-line context summaries attached to every player surface. API calls are cached with configurable TTL. Before the season starts, Savant data falls back to the prior year so intel surfaces stay populated during spring training.

4. **Browser automation** — Write operations (add, drop, trade, lineup changes) use Playwright to automate the Yahoo Fantasy website directly, since Yahoo's API no longer grants write scope to new developer apps. Read operations still use the fast OAuth API.

5. **Prospect news intelligence** — A qualitative news layer that ingests prospect-specific articles from 16 sources (via the news aggregator) plus MLB Stats API transactions, classifies call-up signals using 50+ keyword patterns (bullish: "called up", "expected to join", "likely for Opening Day"; bearish: "optioned", "assigned to minors", "placed on IL"), scores them with Bayesian updating (source tier weighting + exponential time decay), and blends the result with stat-based call-up probabilities (65% stat / 35% news, capped at +/-30pp). Event deduplication prevents multiple articles about the same roster move from over-compounding. Every prospect tool — rankings, stash advisor, trade targets, comparisons — reflects the news-adjusted probabilities.

6. **Inline UI apps** — 20 tools render React UIs directly inside Claude's response. Four single-file HTML apps built with Plex UI and Recharts cover 75+ views — tables, charts, radar plots, heatmaps, dashboards. The rest return clean text to keep the chat uncluttered.

7. **Workflow tools** — Eleven aggregated tools (`yahoo_morning_briefing`, `yahoo_game_day_manager`, `yahoo_trade_pipeline`, etc.) each bundle 5-7+ API calls server-side so the agent gets everything it needs in one shot. A full daily routine takes 2-3 tool calls instead of 15+.

**Built with:** [yahoo_fantasy_api](https://github.com/uberfastman/yahoo_fantasy_api) | [pybaseball](https://github.com/jldbc/pybaseball) | [MLB-StatsAPI](https://github.com/toddrob99/MLB-StatsAPI) | [MCP Apps (ext-apps)](https://github.com/anthropics/model-context-protocol/tree/main/packages/ext-apps) | [Playwright](https://playwright.dev/) | [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)

**Environment variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `YAHOO_CONSUMER_KEY` | Yes | — | Yahoo app consumer key (from developer.yahoo.com) |
| `YAHOO_CONSUMER_SECRET` | Yes | — | Yahoo app consumer secret |
| `LEAGUE_ID` | Yes | — | Yahoo Fantasy league key (e.g., `469.l.16960`) |
| `TEAM_ID` | Yes | — | Your team key (e.g., `469.l.16960.t.12`) |
| `ENABLE_WRITE_OPS` | No | `false` | Enable write operation tools (add, drop, trade, lineup) |
| `MCP_TOOLSET` | No | `default` | Tool profile to load: `default` (~26 tools), `full` (~50), `draft-day`, `analysis`, `automation`, or `all` (123). Comma-separate individual toolsets: `core,trades,intel` |
| `AGENT_AUTONOMY` | No | `semi-auto` | Agent autonomy level: `full-auto`, `semi-auto`, or `manual` |
| `ENABLE_HISTORY` | No | `false` | Enable league history tools (8 tools, requires `config/league-history.json`) |
| `ENABLE_PREVIEW` | No | `false` | Serve the preview dashboard at `/preview` |
| `WEBHOOK_TOKEN` | For OpenClaw | — | Bearer token for `/hooks/wake` and `/hooks/agent` webhook endpoints |
| `MCP_SERVER_URL` | For Claude.ai | — | Public HTTPS URL for remote access |
| `MCP_AUTH_PASSWORD` | For Claude.ai | — | Password for the OAuth login page |

The game key changes each MLB season (e.g., `469` for 2026). Run `./yf discover` to find your league and team IDs automatically.

**Optional config files:**

- `config/league-history.json` — Map of year to league key for historical records
- `config/draft-cheatsheet.json` — Draft strategy and targets (see `.example`)
- `data/player-rankings-YYYY.json` — Hand-curated player rankings (fallback for valuations engine)

**Project files:**

```
baseclaw/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── yf                              # CLI helper script (with --json and api modes)
├── SKILL.md                        # ClawHub manifest (install metadata + overview)
├── AGENTS.md                       # Agent persona for autonomous GM
├── openclaw/                       # OpenClaw integration package
│   ├── install.sh                  # OpenClaw workspace installer
│   ├── AGENTS.md                   # Agent operational framework
│   ├── SOUL.md                     # Agent persona and identity
│   ├── TOOLS.md                    # MCP tool conventions and profiles
│   ├── HEARTBEAT.md                # Proactive check checklist
│   ├── MEMORY.md                   # Persistent memory template
│   ├── USER.md                     # User preferences
│   ├── config/
│   │   ├── openclaw.json           # Gateway configuration template
│   │   └── mcporter.json           # MCP server registration
│   ├── cron/
│   │   └── jobs.json               # 8 scheduled cron jobs
│   ├── workflows/
│   │   ├── waiver-claim.lobster    # Waiver claim pipeline with approval
│   │   ├── trade-proposal.lobster  # Trade proposal pipeline with approval
│   │   ├── roster-cleanup.lobster  # Roster cleanup pipeline with approval
│   │   └── morning-routine.lobster # Daily briefing + lineup
│   └── hooks/
│       ├── baseclaw-roster-alerts/ # Push notifications for injuries/trades
│       ├── baseclaw-memory-flush/  # Pre-compaction memory persistence
│       └── baseclaw-health/        # Gateway startup health check
├── config/
│   ├── yahoo_oauth.json            # OAuth credentials + tokens (gitignored, auto-generated from env vars)
│   ├── yahoo_session.json          # Browser session (gitignored, for write ops)
│   ├── auth-state.json             # MCP OAuth tokens + client registrations (gitignored, auto-managed)
│   ├── league-history.json         # Optional: historical league keys
│   └── draft-cheatsheet.json       # Optional: draft strategy
├── data/
│   ├── player-rankings-YYYY.json   # Optional: curated rankings
│   ├── projections_hitters.csv     # Auto-fetched consensus projections (gitignored)
│   └── projections_pitchers.csv    # Auto-fetched consensus projections (gitignored)
├── scripts/
│   ├── install.sh                   # One-command installer (curl | bash)
│   ├── api-server.py               # Flask API server (~120 endpoints, workflow + strategy)
│   ├── yahoo-fantasy.py            # League management
│   ├── season-manager.py           # In-season management + strategy engine
│   ├── draft-assistant.py          # Draft day tool
│   ├── yahoo_browser.py            # Playwright browser automation
│   ├── history.py                  # Historical records
│   ├── intel.py                    # Fantasy intelligence (Statcast, splits, arsenal, caching)
│   ├── news.py                     # 16-source news aggregator (RSS, Reddit, Bluesky)
│   ├── prospects.py                # Prospect intelligence (MiLB stats, call-up probability, stash advisor)
│   ├── prospect_news.py            # Prospect news sentiment (signal classification, Bayesian updating)
│   ├── valuations.py               # Z-score valuation engine (consensus, park factors, ROS tracking)
│   ├── snapshot.py                 # Weekly state snapshots (projections, roster, standings)
│   ├── backtest.py                 # Backtest replay engine (lineup efficiency vs actuals)
│   ├── mlb-data.py                 # MLB Stats API helper
│   ├── mlb_id_cache.py             # Player name → MLB ID mapping
│   ├── shared.py                   # Shared utilities (team key detection, name normalization)
│   ├── setup-openclaw.sh           # OpenClaw integration setup (mcporter + skill + cron)
│   └── remove-openclaw.sh          # OpenClaw integration removal
└── mcp-apps/                       # TypeScript MCP server + UI apps
    ├── server.ts                   # MCP server setup + tool registration
    ├── main.ts                     # Entry point (stdio + HTTP + webhooks)
    ├── assets/logo-128.png         # Server icon (pixel-art baseball)
    ├── src/tools/                  # 12 tool files, 129 MCP tools
    ├── src/webhooks.ts             # Native webhook endpoints (/hooks/wake, /hooks/agent)
    ├── src/api/                    # Python API client + type definitions
    └── ui/                         # 4 inline HTML apps, 75+ views (React + Plex UI + Recharts)
```

**CLI commands:**

The `./yf` helper script provides direct CLI access to all functionality:

```
./yf <command> [args]
./yf --json <command> [args]   # JSON output mode for programmatic use
./yf api <endpoint> [params]   # Direct API calls (e.g., yf api /api/rankings)
./yf api-list                  # List all available API endpoints
```

| Category | Commands |
|----------|----------|
| **Setup** | `discover` |
| **League** | `info`, `standings`, `roster`, `fa B/P [n]`, `search <name>`, `add <id>`, `drop <id>`, `swap <add> <drop>`, `matchups [week]`, `scoreboard`, `transactions [type] [n]`, `stat-categories`, `player-stats <name> [period] [week]`, `waivers`, `taken-players [position]`, `roster-history [--week N] [--date YYYY-MM-DD]` |
| **Draft** | `status`, `recommend`, `watch [sec]`, `cheatsheet`, `best-available [B\|P] [n]` |
| **Valuations** | `rankings [B\|P] [n]`, `compare <name1> <name2>`, `value <name>`, `import-csv <file>`, `generate` |
| **In-Season** | `lineup-optimize [--apply]`, `category-check`, `injury-report`, `waiver-analyze [B\|P] [n]`, `streaming [week]`, `trade-eval <give> <get>`, `daily-update`, `roster-stats [--period season\|week] [--week N]` |
| **Analytics** | `snapshot [week]`, `backtest --year YYYY --weeks N-M [--verbose] [--json]` |
| **MLB** | `mlb teams`, `mlb roster <tm>`, `mlb stats <id>`, `mlb schedule`, `mlb injuries` |
| **Browser** | `browser-login`, `browser-status`, `browser-test`, `change-team-name <name>`, `change-team-logo <path>` |
| **API** | `api <endpoint> [key=val]`, `api-list` |
| **Docker** | `build`, `restart`, `shell`, `logs` |

</details>

<details>
<summary><strong>All tools reference</strong></summary>

130 tools across 12 tool files. Default profile loads ~26 tools; set `MCP_TOOLSET` to load more (see env vars). Core dashboards and action tools (20) render interactive UI in Claude; the rest return text.

**Roster Management** (16 tools)

| Tool | Description |
|------|-------------|
| `yahoo_roster` | Show current fantasy roster with positions and eligibility |
| `yahoo_free_agents` | List top free agents (batters or pitchers) |
| `yahoo_player_list` | Browse the full player list with position filters, stats, and enrichment |
| `yahoo_search` | Search for a player by name among free agents |
| `yahoo_who_owns` | Check who owns a specific player by player ID |
| `yahoo_percent_owned` | Ownership percentage for specific players across Yahoo |
| `yahoo_add` | Add a free agent to your roster |
| `yahoo_drop` | Drop a player from your roster |
| `yahoo_swap` | Atomic add+drop: add one player and drop another |
| `yahoo_waiver_claim` | Submit a waiver claim with optional FAAB bid and optional drop |
| `yahoo_browser_status` | Check if the browser session for write operations is valid |
| `yahoo_change_team_name` | Change your fantasy team name |
| `yahoo_change_team_logo` | Change your fantasy team logo (PNG/JPG image) |
| `yahoo_player_stats` | Player fantasy stats for any period (season, week, date, last 7/14/30 days) |
| `yahoo_waivers` | Players currently on waivers (in claim period, not yet free agents) |
| `yahoo_all_rostered` | All rostered players across the league with team ownership |

**League & Standings** (11 tools)

| Tool | Description |
|------|-------------|
| `yahoo_league_context` | Compact league profile: waiver type, scoring format, stat categories, roster slots, FAAB balance. Call once at session start |
| `yahoo_standings` | League standings with win-loss records |
| `yahoo_matchups` | Weekly H2H matchup pairings |
| `yahoo_my_matchup` | Detailed H2H matchup with per-category comparison |
| `yahoo_transactions` | Recent league transactions (add, drop, trade) |
| `yahoo_transaction_trends` | Most added and most dropped players across Yahoo |
| `yahoo_league_pulse` | League activity — moves and trades per team |
| `yahoo_league_intel` | Comprehensive league intelligence: multi-layer power rankings (adjusted z-scores blending projections + statcast quality + regression signals + hot/cold trends with standings and quality rank), top 30 performers across all teams with quality/regression flags, team profiles with category strengths/weaknesses and trade fit analysis, z-upside detection for teams with hidden value |
| `yahoo_power_rankings` | Teams ranked by adjusted z-score composite (projections + statcast + regression + trends + standings). Use `yahoo_league_intel` for the full picture |
| `yahoo_positional_ranks` | Positional rankings for all teams with grades and trade partner recommendations |
| `yahoo_season_pace` | Projected season pace, playoff probability, and magic numbers |

**In-Season Management** (27 tools)

| Tool | Description |
|------|-------------|
| `yahoo_lineup_optimize` | Optimize daily lineup via ILP solver (globally optimal player-to-slot assignment with greedy fallback) |
| `yahoo_category_check` | Your rank in each stat category vs the league |
| `yahoo_injury_report` | Check roster for injured players and suggest IL moves |
| `yahoo_streaming` | Multi-factor streaming pitcher scoring: pitcher quality (SIERA, K-BB%), park factor, opponent quality, two-start bonus, Stuff+ quality, opponent travel fatigue. Format-aware (conservative in roto) |
| `yahoo_scout_opponent` | Scout current matchup opponent — strengths, weaknesses, counter-strategies |
| `yahoo_matchup_strategy` | Volatility-based category classification (WIN/LOSE/TOSS-UP) with per-category action recommendations |
| `yahoo_set_lineup` | Move specific player(s) to specific position(s) |
| `yahoo_pending_trades` | View all pending incoming and outgoing trade proposals |
| `yahoo_propose_trade` | Propose a trade to another team |
| `yahoo_accept_trade` | Accept a pending trade |
| `yahoo_reject_trade` | Reject a pending trade |
| `yahoo_whats_new` | Digest of injuries, pending trades, league activity, trending pickups, prospect call-ups |
| `yahoo_week_planner` | Games-per-day grid with heatmap for your roster (off-days, two-start pitchers) |
| `yahoo_closer_monitor` | Monitor closer situations — your closers, available closers, saves leaders |
| `yahoo_pitcher_matchup` | Pitcher matchup quality for your SPs based on opponent batting stats |
| `yahoo_roster_stats` | Per-player stat breakdown for your roster (season totals or specific week) |
| `yahoo_faab_recommend` | Kelly criterion FAAB bidding: half-Kelly with posterior variance from Bayesian model, competition shading from ownership%, category scarcity bonus, season phase multiplier, contender detection |
| `yahoo_ownership_trends` | Ownership trend data from season.db — accumulates as you use waiver/trending tools |
| `yahoo_category_trends` | Category rank trends over time with Recharts line chart visualization |
| `yahoo_punt_advisor` | Research-backed punt viability ratings (puntable/not, risk level, reasoning) with category correlation warnings. Format-aware (punting disabled in roto) |
| `yahoo_il_stash_advisor` | Cross-reference injury timelines with playoff schedule and player upside |
| `yahoo_optimal_moves` | Multi-move optimizer — best add/drop sequence to maximize net roster z-score |
| `yahoo_playoff_planner` | Calculate category gaps to playoff threshold and recommend specific moves |
| `yahoo_trash_talk` | Generate league-appropriate banter based on matchup context |
| `yahoo_rival_history` | Head-to-head record vs each manager (current season, or all-time with league-history.json) |
| `yahoo_achievements` | Track milestones — best ERA week, longest win streak, most moves |
| `yahoo_weekly_narrative` | Auto-generated weekly recap with category analysis and season story arc |

**Valuations** (7 tools)

| Tool | Description |
|------|-------------|
| `yahoo_rankings` | Top players ranked by z-score value (consensus projections, park-adjusted) |
| `yahoo_compare` | Compare two players side by side with z-score breakdowns |
| `yahoo_value` | Full z-score breakdown for a player across all categories |
| `yahoo_projections_update` | Force-refresh projections from FanGraphs (consensus, steamer, zips, or fangraphsdc) |
| `yahoo_zscore_shifts` | Players whose z-score value has shifted most since draft day (rising/falling) |
| `yahoo_projection_disagreements` | Players where projection systems disagree most — draft sleeper/bust signals |
| `fantasy_projection_confidence` | Bayesian blend ratios per stat — shows projection% vs actual% weight, posterior variance, confidence level, and days until actuals dominate. Helps assess how much to trust current projections for trades, waivers, and lineup decisions |

**Intelligence** (10 tools)

| Tool | Description |
|------|-------------|
| `fantasy_player_report` | Deep-dive Statcast radar chart + SIERA (expected ERA) + platoon splits + arsenal + bat tracking + trends + Reddit buzz |
| `fantasy_reddit_buzz` | What r/fantasybaseball is talking about — hot posts, trending topics |
| `fantasy_trending_players` | Players with rising buzz on Reddit |
| `fantasy_prospect_watch` | Recent MLB prospect call-ups and roster moves |
| `fantasy_transactions` | Recent fantasy-relevant MLB transactions (IL, call-up, DFA, trade) |
| `yahoo_statcast_history` | Compare a player's Statcast profile now vs. 30/60 days ago |
| `yahoo_player_intel` | Comprehensive qualitative intelligence briefing — news, injury severity, hot/cold streaks, role changes, Reddit buzz, ownership trends, and Statcast quality tier in one formatted report |
| `fantasy_news_feed` | Real-time news from 16 sources (ESPN, FanGraphs, CBS, Yahoo, MLB.com, RotoWire, Pitcher List, Razzball, Google News, RotoBaller, Reddit, 5 Bluesky analyst feeds) — filter by source or player |
| `fantasy_bat_tracking_breakouts` | Hitters with improving bat speed, fast-swing rate, and squared-up rate from Baseball Savant bat tracking data. Cross-references with z-scores to find buy-low breakout candidates weeks before traditional stats reflect improvement |
| `fantasy_pitch_mix_breakouts` | Pitchers making significant arsenal changes — usage shifts >= 10%, velocity changes >= 1.5 mph, new pitches added. Cross-referenced with effectiveness metrics (whiff rate, run value) and z-scores to rank by breakout signal strength |

**Prospect Intelligence** (11 tools)

| Tool | Description |
|------|-------------|
| `fantasy_prospect_report` | Deep prospect analysis with MiLB stats, scouting evaluation, call-up probability, and stash recommendation |
| `fantasy_prospect_rankings` | Top prospects ranked by composite score with call-up probabilities. Filter by position, level, or team |
| `fantasy_callup_wire` | Recent MLB call-ups with fantasy impact analysis — prospect ranks, opportunity created |
| `fantasy_stash_advisor` | NA stash recommendations based on call-up probability and league context |
| `fantasy_prospect_compare` | Side-by-side prospect comparison — stats, grades, call-up probability, and evaluation |
| `fantasy_prospect_buzz` | Reddit prospect buzz and discussion tracker — trending prospect posts and mentions |
| `fantasy_eta_tracker` | Track call-up probability changes for watchlist prospects — flags significant movements |
| `fantasy_prospect_trade_targets` | League-specific prospect trade targets — identifies stashed prospects on other teams worth acquiring |
| `fantasy_prospect_watch_add` | Add or remove a prospect from your ETA watchlist for tracking call-up probability changes |
| `fantasy_prospect_news` | Qualitative news intelligence for a prospect — aggregates front office quotes, beat reporter intel, roster decisions from 16 sources. Signal classification with Bayesian probability updating |

**Analytics & Strategy** (4 tools)

| Tool | Description |
|------|-------------|
| `fantasy_probable_pitchers` | Probable pitchers for upcoming games |
| `fantasy_schedule_analysis` | Schedule-based analysis for streaming and lineup planning |
| `fantasy_regression_candidates` | Research-calibrated regression scoring (-100 to +100): 6 hitter signals (xwOBA, BABIP, HR/FB vs barrels, plate discipline, hard-hit divergence, sprint speed) and 8 pitcher signals (ERA vs SIERA, K-BB% vs ERA, xERA, K-rate adjusted BABIP, LOB%, HR/FB%, velocity trend, Stuff+ confidence modifier). Each player gets a composite score, direction, confidence level, and per-signal breakdowns |
| `fantasy_travel_fatigue` | Travel fatigue scores for MLB teams based on timezone changes, schedule density, and day/night patterns. Built on peer-reviewed PNAS research (46,535 games). Use for streaming decisions (target fatigued opponents) and lineup optimization |

**MLB Data** (9 tools)

| Tool | Description |
|------|-------------|
| `mlb_teams` | List all MLB teams with abbreviations |
| `mlb_roster` | MLB team roster by abbreviation (NYY, LAD, etc.) |
| `mlb_player` | MLB player info by Stats API player ID |
| `mlb_stats` | Player season stats by Stats API player ID |
| `mlb_injuries` | Current MLB injuries across all teams |
| `mlb_standings` | MLB division standings |
| `mlb_schedule` | MLB game schedule (today or specific date) |
| `mlb_draft` | MLB draft picks by year |
| `yahoo_weather` | Real-time weather (temperature, wind, condition) from MLB game feed with risk assessment |

**League History** (8 tools, requires `ENABLE_HISTORY=true`)

| Tool | Description |
|------|-------------|
| `yahoo_league_history` | All-time season results with finish position chart — champions, your finishes, W-L-T records |
| `yahoo_record_book` | All-time records with bar charts — career W-L, best seasons, playoff appearances, #1 draft picks |
| `yahoo_past_standings` | Full standings for a past season with win-loss stacked bar chart |
| `yahoo_past_draft` | Draft picks for a past season with player names |
| `yahoo_past_teams` | Team names, managers, move/trade counts for a past season |
| `yahoo_past_trades` | Trade history for a past season |
| `yahoo_past_matchup` | Matchup results for a specific week in a past season |
| `yahoo_roster_history` | View any team's roster from a past week or specific date |

**Workflows** (11 tools)

Aggregated tools that bundle 5-7+ API calls server-side so the agent gets a complete picture in one shot.

| Tool | Description |
|------|-------------|
| `yahoo_morning_briefing` | Daily briefing: injuries, lineup issues, matchup scores, category strategy, league activity, opponent moves, and waiver targets — replaces 7+ individual tool calls |
| `yahoo_league_landscape` | League intelligence: standings, playoff projections, roster strength, manager activity, transactions, matchup results, and trade opportunities |
| `yahoo_roster_health_check` | Roster audit: injured players in active slots, healthy players on IL, bust candidates, off-day starters — ranked by severity |
| `yahoo_waiver_recommendations` | Best waiver pickups for weak categories with recommended drops and projected category impact |
| `yahoo_auto_lineup` | Auto-optimize lineup: bench off-day players, start active bench players, flag injured starters (write operation) |
| `yahoo_trade_analysis` | Surplus value trade analysis: roster spot tax, category fit bonus, consolidation premium, catcher scarcity, rival warnings. A+/F letter grading with full breakdown |
| `yahoo_game_day_manager` | Pre-game pipeline: schedule, weather risks, injury check, lineup optimization, and streaming recommendation |
| `yahoo_waiver_deadline_prep` | Pre-deadline waiver analysis with FAAB bid recommendations and simulated category impact |
| `yahoo_trade_pipeline` | End-to-end trade search: complementary partners, package values, category impact, and graded proposals |
| `yahoo_weekly_digest` | End-of-week summary: matchup result, standings, transactions, achievements, and prose narrative |
| `yahoo_season_checkpoint` | Monthly assessment: rank, playoff probability, category trajectory, punt strategy, and trade targets |

**Meta** (2 tools)

| Tool | Description |
|------|-------------|
| `discover_capabilities` | Browse available tool categories and find tools for specific tasks. Call with no arguments to see all categories, or with a category name to list its tools |
| `get_tool_details` | Get full description and parameters for any tool by name — including tools not loaded in the current toolset profile |

**Write operations** (12 tools, requires `ENABLE_WRITE_OPS=true`)

`yahoo_add`, `yahoo_drop`, `yahoo_swap`, `yahoo_waiver_claim`, `yahoo_set_lineup`, `yahoo_propose_trade`, `yahoo_accept_trade`, `yahoo_reject_trade`, `yahoo_browser_status`, `yahoo_change_team_name`, `yahoo_change_team_logo`, `yahoo_auto_lineup`

</details>

<details>
<summary><strong>Comparison with alternatives</strong></summary>

| | **BaseClaw** | **Flaim** | **yahoo-fantasy-baseball-mcp** | **Manual** |
|---|---|---|---|---|
| Tools | 130 | ~30 | ~15 | 0 |
| Yahoo Fantasy API | Full read + browser write | Read only | Read only | Website |
| Statcast / Savant | Built-in (xwOBA, Stuff+, barrel rate, bat tracking, percentiles) | No | No | Separate lookup |
| Z-score valuations | FVARz with consensus projections, park factors, decay curve | Basic rankings | No | Spreadsheet |
| Trade analysis | Surplus value, category fit, rival blocking, letter grades | Basic comparison | No | Gut feel |
| Prospect intelligence | MiLB stats + scouting + Bayesian call-up probability from 16 news sources | No | No | Manual research |
| Regression engine | 14-signal research-calibrated scoring (-100 to +100) | No | No | Eye test |
| Inline UI | 20 React apps, 75+ views (charts, radar, heatmaps) | Text only | Text only | N/A |
| Agent automation | Full cron schedule, 3 autonomy levels, 11 workflow tools | No | No | N/A |
| Lineup optimizer | ILP solver (scipy) with greedy fallback | No | No | Manual |
| News aggregation | 16 sources (ESPN, FanGraphs, Reddit, Bluesky, etc.) | No | No | Manual |
| Setup | `curl \| bash` (10 min) | Manual | Manual | N/A |

</details>

## Write operations (optional)

To let Claude make roster moves (add, drop, trade, set lineup), set `ENABLE_WRITE_OPS=true` in `.env`, rebuild with `docker compose up -d`, and set up a browser session:

```bash
./yf browser-login
```

Log into Yahoo in the browser that opens. The session saves to `config/yahoo_session.json` and lasts 2-4 weeks. When `ENABLE_WRITE_OPS=false` (default), all 12 write tools are hidden entirely.

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/jweingardt12/baseclaw/main/scripts/install.sh | bash -s -- --uninstall
```
