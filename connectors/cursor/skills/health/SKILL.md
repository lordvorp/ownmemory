---
name: health
description: >-
  Diagnose OwnMemory MCP, local HTTP console, embedder readiness, and Cursor
  plugin install. Use when recall fails, MCP shows Not connected, or after upgrades.
---

# OwnMemory health

Run all checks, then one summary.

1. **Plugin install** — `~/.cursor/plugins/local/ownmemory` exists and points at `connectors/cursor`.
2. **Home slices** — `readlink -f ~/.cursor/mcp.json` → repo `.cursor-home/mcp.json`.
3. **MCP** — `whoAmI` returns version + embeddingModel + embeddingReady.
4. **HTTP** (optional) — `GET http://127.0.0.1:47321/api/health` if the Next console is running.
5. **Data** — `OWNMEMORY_DATA_DIR` unset ⇒ `~/.ownmemory`; DB file present.

Do not suggest Mem0 keys or cloud memory.
