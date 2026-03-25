#!/bin/sh

# Auto-generate yahoo_oauth.json from env vars if the file doesn't exist.
# The yahoo-oauth library reads credentials from this file and writes
# refreshed tokens back to it, so it must remain a writable file on disk.
OAUTH_FILE="${OAUTH_FILE:-/app/config/yahoo_oauth.json}"

if [ ! -f "$OAUTH_FILE" ]; then
  if [ -n "$YAHOO_CONSUMER_KEY" ] && [ -n "$YAHOO_CONSUMER_SECRET" ]; then
    echo "Generating $OAUTH_FILE from YAHOO_CONSUMER_KEY/YAHOO_CONSUMER_SECRET env vars"
    cat > "$OAUTH_FILE" <<EOF
{
    "consumer_key": "$YAHOO_CONSUMER_KEY",
    "consumer_secret": "$YAHOO_CONSUMER_SECRET"
}
EOF
  else
    echo "INFO: $OAUTH_FILE not found and YAHOO_CONSUMER_KEY/YAHOO_CONSUMER_SECRET not set."
    echo "The setup wizard will be available at http://0.0.0.0:${PORT:-4951}/setup"
  fi
fi

# Check if we have Yahoo OAuth tokens (access_token in the oauth file).
# If not, the Node server will start in setup wizard mode and the Python
# API server is not needed yet.
HAS_TOKENS=false
if [ -f "$OAUTH_FILE" ]; then
  if grep -q '"access_token"' "$OAUTH_FILE" 2>/dev/null; then
    HAS_TOKENS=true
  fi
fi

if [ "$HAS_TOKENS" = "true" ]; then
  echo "Starting Python API server + MCP server..."
  python3 /app/scripts/api-server.py &
else
  echo "Skipping Python API server (no Yahoo tokens yet — setup wizard mode)"
fi

exec node /app/mcp-apps/dist/main.js
