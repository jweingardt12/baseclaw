#!/usr/bin/env bash
set -euo pipefail

# BaseClaw <-> OpenClaw integration setup
# Registers MCP server, installs skill, optionally sets up cron jobs.
# Idempotent — safe to run multiple times.

INSTALL_DIR="${BASECLAW_DIR:-$HOME/.baseclaw}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Support running from install dir or repo checkout
if [ -f "$INSTALL_DIR/SKILL.md" ]; then
  BASE_DIR="$INSTALL_DIR"
elif [ -f "$SCRIPT_DIR/../SKILL.md" ]; then
  BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  BASE_DIR="$INSTALL_DIR"
fi

OC_HOME="$HOME/.openclaw"
MCPORTER_CFG="$OC_HOME/workspace/config/mcporter.json"
SKILL_DIR="$OC_HOME/workspace/skills/baseclaw"
ENV_FILE="$INSTALL_DIR/.env"

# Colors
if [ -t 1 ]; then
  GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; BOLD=''; NC=''
fi

info()  { printf "${GREEN}>${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}!${NC} %s\n" "$*"; }
err()   { printf "${RED}x${NC} %s\n" "$*" >&2; }
ok()    { printf "${GREEN}ok${NC} %s\n" "$*"; }

# Require python3
if ! command -v python3 >/dev/null 2>&1; then
  err "python3 is required but not found"; exit 1
fi

# ---------------------------------------------------------------------------
# Step 1: Detect OpenClaw
# ---------------------------------------------------------------------------
if [ ! -d "$OC_HOME" ]; then
  echo "OpenClaw not detected (~/.openclaw not found). Skipping."
  exit 0
fi

HAS_OPENCLAW=false
if command -v openclaw >/dev/null 2>&1; then
  HAS_OPENCLAW=true
fi

info "OpenClaw detected at $OC_HOME"

# ---------------------------------------------------------------------------
# Step 2: Register MCP server in mcporter
# ---------------------------------------------------------------------------
info "Registering MCP server..."

# Read MCP_AUTH_PASSWORD from .env if available
MCP_PW=""
if [ -f "$ENV_FILE" ]; then
  MCP_PW=$(grep "^MCP_AUTH_PASSWORD=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-) || true
  # Skip placeholder values
  if [[ "$MCP_PW" == your_*_here ]] || [ -z "$MCP_PW" ]; then
    MCP_PW=""
  fi
fi

python3 - "$MCPORTER_CFG" "$MCP_PW" <<'PYEOF'
import json, sys, os

cfg_path, mcp_pw = sys.argv[1], sys.argv[2]

try:
    with open(cfg_path) as f:
        cfg = json.load(f)
except (json.JSONDecodeError, FileNotFoundError, OSError):
    cfg = {}

servers = cfg.setdefault("mcpServers", {})

if "baseclaw" in servers:
    print("baseclaw already registered in " + cfg_path)
    sys.exit(0)

entry = {"url": "http://localhost:4951/mcp"}
if mcp_pw:
    entry["headers"] = {"Authorization": "Bearer " + mcp_pw}

servers["baseclaw"] = entry
os.makedirs(os.path.dirname(cfg_path) or ".", exist_ok=True)
with open(cfg_path, "w") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
print("Added baseclaw to " + cfg_path)
PYEOF

ok "MCP server registered"

# ---------------------------------------------------------------------------
# Step 3: Install skill files
# ---------------------------------------------------------------------------
info "Installing skill files..."

mkdir -p "$SKILL_DIR"

COPIED=0
for f in SKILL.md AGENTS.md; do
  if [ -f "$BASE_DIR/$f" ]; then
    cp "$BASE_DIR/$f" "$SKILL_DIR/$f"
    COPIED=$((COPIED + 1))
  else
    warn "$f not found at $BASE_DIR/$f"
  fi
done

ok "Skill installed at $SKILL_DIR ($COPIED files)"

# ---------------------------------------------------------------------------
# Step 4: Cron job registration (optional, requires openclaw CLI)
# ---------------------------------------------------------------------------
CRON_FILE="$BASE_DIR/openclaw-cron-examples.json"
CRON_COUNT=0

if [ "$HAS_OPENCLAW" = true ] && [ -f "$CRON_FILE" ]; then
  echo ""
  echo "Available scheduled jobs:"
  echo "  1. Daily morning briefing + auto lineup    (9:00 AM)"
  echo "  2. Daily pre-lock lineup check             (10:30 AM)"
  echo "  3. Monday matchup plan                     (8:00 AM)"
  echo "  4. Tuesday waiver deadline prep             (8:00 PM)"
  echo "  5. Thursday streaming check                (9:00 AM)"
  echo "  6. Saturday roster audit                   (9:00 AM)"
  echo "  7. Sunday weekly digest                    (9:00 PM)"
  echo "  8. Monthly season checkpoint               (10:00 AM, 1st)"
  echo ""

  read -rp "Register cron jobs with OpenClaw? [Y/n] " DO_CRON
  DO_CRON="${DO_CRON:-Y}"

  if [[ "$DO_CRON" =~ ^[Yy] ]]; then
    # Detect system timezone
    SYS_TZ=""
    if command -v timedatectl >/dev/null 2>&1; then
      SYS_TZ=$(timedatectl show -p Timezone --value 2>/dev/null) || true
    fi
    if [ -z "$SYS_TZ" ] && [ -f /etc/localtime ]; then
      SYS_TZ=$(readlink /etc/localtime 2>/dev/null | sed 's|.*/zoneinfo/||') || true
    fi
    SYS_TZ="${SYS_TZ:-America/New_York}"

    echo "  (MLB games use Eastern time — most users should keep America/New_York)"
    read -rp "Timezone for cron jobs? [$SYS_TZ] " USER_TZ
    USER_TZ="${USER_TZ:-$SYS_TZ}"

    # Register each job via openclaw CLI (reads JSON, calls openclaw cron add)
    CRON_COUNT=$(python3 - "$CRON_FILE" "$USER_TZ" <<'PYEOF'
import json, sys, subprocess

cron_file, tz = sys.argv[1], sys.argv[2]

try:
    with open(cron_file) as f:
        jobs = json.load(f)
except (json.JSONDecodeError, FileNotFoundError, OSError) as e:
    print("Error reading " + cron_file + ": " + str(e), file=sys.stderr)
    print(0)
    sys.exit(0)

registered = 0
for job in jobs:
    cmd = [
        "openclaw", "cron", "add",
        "--name", job.get("name", ""),
        "--cron", job.get("schedule", {}).get("expr", ""),
        "--tz", tz,
        "--session", job.get("sessionTarget", "isolated"),
        "--message", job.get("payload", {}).get("message", ""),
        "--announce",
    ]
    timeout_s = job.get("payload", {}).get("timeoutSeconds")
    if timeout_s:
        cmd.extend(["--timeout-seconds", str(timeout_s)])
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            registered += 1
        elif "already exists" in result.stderr.lower() or "duplicate" in result.stderr.lower():
            registered += 1
        else:
            msg = result.stderr.strip() or result.stdout.strip()
            print("  Failed: " + job.get("name", "?") + " — " + msg, file=sys.stderr)
    except Exception as e:
        print("  Failed: " + job.get("name", "?") + " — " + str(e), file=sys.stderr)

print(registered)
PYEOF
    )
    ok "$CRON_COUNT cron jobs registered"
  fi
elif [ "$HAS_OPENCLAW" != true ]; then
  warn "openclaw CLI not found — skipping cron registration"
  echo "  Install OpenClaw and run this script again, or register jobs manually."
fi

# ---------------------------------------------------------------------------
# Step 5: Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
printf "  ${GREEN}${BOLD}BaseClaw connected to OpenClaw${NC}\n"
echo "============================================"
echo ""
echo "  MCP:   registered at localhost:4951"
echo "  Skill: installed at $SKILL_DIR"
if [ "${CRON_COUNT:-0}" -gt 0 ]; then
  echo "  Cron:  $CRON_COUNT jobs registered"
fi
echo ""
echo "  Try: ask your agent \"how's my fantasy team looking?\""
echo ""
