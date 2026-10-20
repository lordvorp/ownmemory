# OwnMemory — Cursor plugin

Standalone Cursor integration (Mem0-shaped): marketplace-style manifest, local stdio MCP, session hooks, and slash skills. Prefs and data stay on disk (`~/.ownmemory`, optional `~/.cursor` symlinks into this repo’s `.cursor-home/`).

## One-click local install

From the OwnMemory repo (after `npm install` at the root):

```bash
./connectors/cursor/scripts/install-local.sh
```

Then reload Cursor (**Ctrl+R** on Linux) and enable **ownmemory** under Settings → Plugins / MCP if needed.

## What you get

| Surface | Location |
| --- | --- |
| Plugin manifest | [`.cursor-plugin/plugin.json`](.cursor-plugin/plugin.json) |
| MCP (stdio) | [`.cursor-mcp.json`](.cursor-mcp.json) → `bin/run-mcp.mjs` |
| Hooks | [`hooks/cursor-hooks.json`](hooks/cursor-hooks.json) |
| Skills | [`skills/`](skills/) (`onboard`, `health`, `remember`, `forget`, `peek`, `ownmemory`) |
| Home slices (non-plugin) | Repo [`.cursor-home/`](../../.cursor-home/) symlinked into `~/.cursor` |

## GUI status

After `install-local.sh`, Cursor should list **ownmemory** under local plugins:

- **Installed** — `~/.cursor/plugins/local/ownmemory` → this folder
- **Active / inactive** — toggle in Cursor Settings (same pattern as Mem0 marketplace plugins)

No API key. No cloud MCP.

## Cold systems

Use `/ownmemory:onboard` (or the onboard skill). It only enables connectors that match the host (Cursor always; OpenClaw / Open WebUI only when those hosts exist or the user asks).
