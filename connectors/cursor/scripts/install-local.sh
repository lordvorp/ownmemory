#!/usr/bin/env bash
# Install OwnMemory as a local Cursor plugin + refresh ~/.cursor OwnMemory slices.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PLUGIN_SRC="$ROOT/connectors/cursor"
CURSOR_HOME="${CURSOR_HOME:-$HOME/.cursor}"
LOCAL_PLUGINS="$CURSOR_HOME/plugins/local"
DEST="$LOCAL_PLUGINS/ownmemory"
CURSOR_HOME_REPO="$ROOT/.cursor-home"

mkdir -p "$LOCAL_PLUGINS" "$CURSOR_HOME/hooks" "$CURSOR_HOME/rules"

# Rewrite MCP args to this machine's absolute run-mcp path
cat > "$PLUGIN_SRC/.cursor-mcp.json" <<EOF
{
  "mcpServers": {
    "ownmemory": {
      "type": "stdio",
      "command": "node",
      "args": ["$PLUGIN_SRC/bin/run-mcp.mjs"]
    }
  }
}
EOF

# Keep .cursor-home mcp in sync for non-plugin home symlink path
cat > "$CURSOR_HOME_REPO/mcp.json" <<EOF
{
  "mcpServers": {
    "ownmemory": {
      "type": "stdio",
      "command": "node",
      "args": ["$ROOT/bin/ownmemory-mcp.mjs"]
    }
  }
}
EOF

ln -sfn "$PLUGIN_SRC" "$DEST"

ln -sfn "$CURSOR_HOME_REPO/mcp.json" "$CURSOR_HOME/mcp.json"
ln -sfn "$CURSOR_HOME_REPO/hooks/ownmemory-context.py" "$CURSOR_HOME/hooks/ownmemory-context.py"
ln -sfn "$CURSOR_HOME_REPO/rules/ownmemory-over-mem0.mdc" "$CURSOR_HOME/rules/ownmemory-over-mem0.mdc"

echo "OwnMemory Cursor plugin installed:"
echo "  plugin -> $DEST"
echo "  mcp    -> $(readlink -f "$CURSOR_HOME/mcp.json")"
echo "Enable/disable in Cursor Settings → Plugins / MCP (ownmemory)."
echo "Reload window if tools do not appear (Linux: Ctrl+R)."
