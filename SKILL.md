---
name: baseclaw
description: Autonomous fantasy baseball GM — 113 MCP tools, rich inline UIs, workflow automation, and agent scheduling for Yahoo Fantasy Baseball
---

# BaseClaw

Autonomous fantasy baseball GM for Yahoo Fantasy Baseball. Connects Claude to your league via 113 MCP tools, rich inline UI apps, and scheduled workflow automation.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/jweingardt12/baseclaw/main/scripts/install.sh | bash
```

Or tell your agent: **"install github.com/jweingardt12/baseclaw"**

The installer clones the repo, builds the Docker image, prompts for Yahoo OAuth credentials and league/team IDs, and writes your `.env` file.

## What You Get

- **113 MCP tools** — 93 read, 15 write, 5 workflow
- **9 inline UI apps** with 62 views — standings, matchups, rosters, trades, draft board, player search, season overview, history, and morning briefing
- **Real-time data** — Yahoo Fantasy API, MLB Stats API, and Statcast analytics
- **Workflow automation** — multi-step pipelines that chain tools together for common GM tasks
- **Agent scheduling** — 8 cron jobs that keep your team optimized around the clock

## OpenClaw Setup

After installing BaseClaw, run the OpenClaw setup script:

```bash
~/.baseclaw/scripts/setup-openclaw.sh
```

This registers the MCP server, installs the skill, and optionally sets up
8 scheduled cron jobs for autonomous team management.

**Manual setup** (if you prefer):

1. Register the MCP server:
   ```bash
   npx mcporter config add baseclaw --url http://localhost:4951/mcp
   ```

2. Copy the skill files:
   ```bash
   mkdir -p ~/.openclaw/workspace/skills/baseclaw
   cp SKILL.md AGENTS.md ~/.openclaw/workspace/skills/baseclaw/
   ```

3. Cron jobs can be registered through your OpenClaw agent:
   "Set up BaseClaw scheduled jobs" — it will read the cron schedule
   from the skill and register them.

## Workflow Tools

| Tool | Description |
|------|-------------|
| `yahoo_morning_briefing` | Daily situational awareness — injuries, lineup, matchup, waivers |
| `yahoo_league_landscape` | Weekly league intelligence — standings, rivals, trades |
| `yahoo_roster_health_check` | Roster audit — injuries, IL waste, bust candidates |
| `yahoo_waiver_recommendations` | Decision-ready add/drop pairs with category impact |
| `yahoo_auto_lineup` | Safe daily lineup optimization (idempotent) |
| `yahoo_trade_analysis` | Trade evaluation by player names |
| `yahoo_game_day_manager` | Game-day pipeline: schedule + weather + injuries + lineup + streaming |
| `yahoo_waiver_deadline_prep` | Pre-deadline waiver analysis with FAAB bids and simulation |
| `yahoo_trade_pipeline` | End-to-end trade search, evaluation, and proposal prep |
| `yahoo_weekly_digest` | End-of-week summary with narrative and key performers |
| `yahoo_season_checkpoint` | Monthly strategic assessment with playoff path |

## Cron Schedule

Eight scheduled jobs keep your team managed automatically (all times Eastern):

| Schedule | Job | What It Does |
|----------|-----|--------------|
| Daily 9:00 AM | Morning briefing + auto lineup | Runs situational check, sets optimal lineup, executes urgent actions |
| Daily 10:30 AM | Pre-lock check | Catches weather risks and late scratches before lineup locks |
| Monday 8:00 AM | Matchup plan | Analyzes the week's opponent, sets category targets and strategy |
| Tuesday 8:00 PM | Waiver deadline prep | Ranks waiver claims with FAAB bids, submits top recommendations |
| Thursday 9:00 AM | Streaming check | Finds two-start pitchers and favorable streaming matchups |
| Saturday 9:00 AM | Roster audit | Scans for IL waste, bust candidates, and activation opportunities |
| Sunday 9:00 PM | Weekly digest | Summarizes the week's results, key performers, and standings movement |
| 1st of month 10:00 AM | Season checkpoint | Strategic assessment with category trajectory and playoff outlook |

## Agent Persona

`AGENTS.md` provides the agent with strategy rules, decision tiers, and season-phase awareness:

- **Auto-execute** — routine, low-risk actions (set lineup, activate from IL)
- **Execute + report** — moderate actions with clear upside (top waiver claim, streaming add)
- **Report + wait** — high-impact decisions requiring owner approval (trades, FAAB > 20%)

The agent adapts its strategy based on season phase (draft, early season, midseason, stretch run, playoffs) and current standings position.
