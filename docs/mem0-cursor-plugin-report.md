# Mem0 Cursor plugin — capability report for OwnMemory

**Source inspected:** `~/.cursor/plugins/cache/cursor-public/mem0/965140eb190bf390979d41bb6ffff12c0b02e70b` (Cursor manifest **0.2.13**).  
**Date:** 2026-10-19.  
**Purpose:** Steal UX/architecture ideas for a local-first OwnMemory Cursor plugin; do not copy cloud auth or telemetry.

## How Mem0 shows up in Cursor

Mem0 is a **full plugin package**, not just an MCP entry:

- `.cursor-plugin/plugin.json` — name, version, logo, `skills`, `hooks`, `mcpServers`
- `.cursor-mcp.json` — remote HTTP MCP (`https://mcp.mem0.ai`) + `MEM0_API_KEY`
- `hooks/cursor-hooks.json` — sessionStart, beforeSubmitPrompt, pre/postToolUse, stop, preCompact
- `skills/*` — slash commands (`onboard`, `health`, `remember`, `forget`, `peek`, `dream`, …)
- Marketplace install ⇒ GUI installed / enable-disable; local prefs under `~/.mem0/`

OwnMemory 0.2.1 mirrors this shape under [`connectors/cursor/`](../connectors/cursor/) with **stdio MCP** and **no API key**.

## MCP / API surface (Mem0)

| Tool | Purpose |
| --- | --- |
| `add_memory` | Save (optional cloud `infer` extraction) |
| `search_memories` | Semantic search + filters |
| `get_memories` / `get_memory` | List / fetch by id |
| `update_memory` | Replace text by id |
| `delete_memory` / `delete_all_memories` | Delete |
| `list_entities` / `delete_entities` | Entity graph |
| `get_event_status` | Async write status (cloud) |

Hooks also hit REST `https://api.mem0.ai/v3/...` directly.

## Skills worth adapting locally

| Mem0 skill | OwnMemory analogue (now or later) |
| --- | --- |
| `onboard` | **Done** — `/ownmemory:onboard` cold install |
| `health` | **Done** — `/ownmemory:health` |
| `remember` / `forget` / `peek` | **Done** — thin MCP wrappers |
| `stats` / `tour` | Later — console + `listSpaces` / list APIs |
| `export` / `import` | Later — markdown dump / ingest |
| `dream` / `memory-reviewer` | Later — local consolidation (no cloud infer) |
| `switch-project` / `list-projects` | Partial — spaces / `containerTag` |
| `context-loader` | Partial — hooks + `recall` |
| `pin` | Later — metadata if we extend the schema |

## Hook patterns worth adapting

High value for OwnMemory (all local HTTP/MCP, fail-open):

1. Prompt prefetch before submit (richer than sessionStart-only)
2. Git-remote → stable project/`containerTag` map
3. Stop/compact capture of durable decisions (already light remember hook)
4. Block writing parallel file-memory (`MEMORY.md`) when MCP is the source of truth
5. Session counters (adds/searches) for `/health` and `/stats`

## Do not copy

- Remote MCP / REST / `MEM0_API_KEY` / eval-key onboarding
- PostHog telemetry (`scripts/telemetry.py`, default on)
- Mandatory “Mem0 Active / Setup Required” status-line spam
- Cloud `infer=True` transcript extraction on every stop

## Gap vs OwnMemory today

OwnMemory MCP is intentionally small: `memory`, `recall`, `whoAmI`, `listSpaces`. Highest-ROI expansions inspired by Mem0, still local:

1. get/update/delete by id + paginated list
2. Structured metadata (type, pin, branch, files)
3. Export/import + optional “dream” consolidation skill
4. Richer Cursor hooks (prefetch, file-read context) without leaving the machine

## Conclusion

Mem0’s advantage in Cursor is **packaging** (plugin manifest + skills + hooks + GUI toggle), not the cloud API itself. OwnMemory should keep winning on privacy/local silicon while matching that packaging — which 0.2.1 starts via `connectors/cursor` + `.cursor-home` ownership.
