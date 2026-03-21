#!/usr/bin/env bash
set -euo pipefail

# Remove BaseClaw from OpenClaw
# Removes mcporter entry, skill directory, and cron jobs.

OC_HOME="$HOME/.openclaw"
MCPORTER_CFG="$OC_HOME/workspace/config/mcporter.json"
SKILL_DIR="$OC_HOME/workspace/skills/baseclaw"

# Colors
if [ -t 1 ]; then
  GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; NC='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; NC=''
fi

info()  { printf "${GREEN}>${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}!${NC} %s\n" "$*"; }
ok()    { printf "${GREEN}ok${NC} %s\n" "$*"; }

# Require python3
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but not found"; exit 1
fi

if [ ! -d "$OC_HOME" ]; then
  echo "OpenClaw not found. Nothing to remove."
  exit 0
fi

# ---------------------------------------------------------------------------
# Remove MCP server from mcporter
# ---------------------------------------------------------------------------
if [ -f "$MCPORTER_CFG" ]; then
  python3 - "$MCPORTER_CFG" <<'PYEOF'
import json, sys

cfg_path = sys.argv[1]
try:
    with open(cfg_path) as f:
        cfg = json.load(f)
except (json.JSONDecodeError, FileNotFoundError, OSError):
    sys.exit(0)

servers = cfg.get("mcpServers", {})
if "baseclaw" in servers:
    del servers["baseclaw"]
    with open(cfg_path, "w") as f:
        json.dump(cfg, f, indent=2)
        f.write("\n")
    print("Removed baseclaw from " + cfg_path)
else:
    print("baseclaw not found in " + cfg_path)
PYEOF
  ok "MCP server removed from mcporter"
fi

# ---------------------------------------------------------------------------
# Remove skill directory
# ---------------------------------------------------------------------------
if [ -d "$SKILL_DIR" ]; then
  rm -rf "$SKILL_DIR"
  ok "Skill removed from $SKILL_DIR"
else
  info "Skill directory not found (already removed)"
fi

# ---------------------------------------------------------------------------
# Remove cron jobs via openclaw CLI
# ---------------------------------------------------------------------------
if command -v openclaw >/dev/null 2>&1; then
  # List jobs, match BaseClaw names, remove by ID
  REMOVED=$(python3 - <<'PYEOF'
import subprocess, json, sys

BASECLAW_JOBS = {
    "Daily morning briefing + auto lineup",
    "Daily pre-lock lineup check",
    "Monday matchup plan",
    "Tuesday waiver deadline prep",
    "Thursday streaming check",
    "Saturday roster audit",
    "Sunday weekly digest",
    "Monthly season checkpoint",
}

# Get current cron jobs as JSON
try:
    result = subprocess.run(
        ["openclaw", "cron", "list", "--json"],
        capture_output=True, text=True, timeout=15,
    )
    if result.returncode != 0:
        print(0)
        sys.exit(0)
    jobs = json.loads(result.stdout)
except Exception:
    print(0)
    sys.exit(0)

# Handle list or dict response
if isinstance(jobs, dict):
    jobs = jobs.get("jobs", jobs.get("data", []))

removed = 0
for job in jobs:
    name = job.get("name", "")
    job_id = job.get("id", "")
    if name in BASECLAW_JOBS and job_id:
        try:
            r = subprocess.run(
                ["openclaw", "cron", "rm", str(job_id)],
                capture_output=True, text=True, timeout=15,
            )
            if r.returncode == 0:
                removed += 1
        except Exception:
            pass

print(removed)
PYEOF
  )

  if [ "${REMOVED:-0}" -gt 0 ]; then
    ok "$REMOVED cron jobs removed"
  else
    info "No BaseClaw cron jobs found"
  fi
else
  warn "openclaw CLI not found — skipping cron job removal"
  echo "  Remove cron jobs manually through your OpenClaw agent."
fi

ok "BaseClaw removed from OpenClaw"
