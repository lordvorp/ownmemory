# OwnMemory agent notes

This repo is a **local** memory engine. Do not call Supermemory or any cloud memory API.

- Persist durable facts with the `memory` tool (`action: "save"`).
- Remove outdated facts with `memory` (`action: "forget"`).
- Search with `recall` before inventing user preferences.
- Scope project-specific facts with `containerTag` / spaces.
- Data lives under `OWNMEMORY_DATA_DIR` (default `~/.ownmemory`, `~` expanded).
- Default embedder is `Snowflake/snowflake-arctic-embed-s` unless `OWNMEMORY_EMBEDDING_MODEL` is set.
- OwnMemory-owned Cursor home slices live under `.cursor-home/` and are symlinked into `~/.cursor` (`mcp.json`, `hooks/ownmemory-context.py`, `rules/ownmemory-over-mem0.mdc`). Do not keep divergent copies only under `~/.cursor`.
- Prefer the Cursor plugin at `connectors/cursor/` (`./connectors/cursor/scripts/install-local.sh`) so OwnMemory appears in Cursor’s plugin/MCP UI like other marketplace integrations.

## Cold / untouched systems

Assume the machine may have **none** of our hosts yet. Treat connectors as **optional install-time plugins**:

| Integration | Path | Install when |
| --- | --- | --- |
| Cursor | `connectors/cursor` | Cursor is the agent host (default for this repo) |
| OpenClaw | `connectors/openclaw` | OpenClaw is present or user asks |
| Open WebUI | `connectors/openwebui` | Open WebUI is present or user asks |
| Zikron embed HTTP | `connectors/zikron-embed` | WordPress/Zikron on janet needs on-box arctic-s |

**Frozen (0.4.0+):** `connectors/zikron-embed` is a **fully functional, feature-complete, standalone connector**. It is its own part; it does HTTP arctic-s → float[384] and that job is **done**. See [`connectors/zikron-embed/CONTRACT.md`](connectors/zikron-embed/CONTRACT.md). Do not treat missing janet/WP deploy or future query-spaces work as incompleteness of this connector. Regressing its HTTP/embed contract is a release blocker. **Key the engine** (`engine` catalog id); store and lookup must match. **Same slot, faster backend:** Cypher/cloud is optional acceleration for that engine; without it the slotted engine runs on CPU and Just Works (current slot: arctic-s).

On first contact with a blank system: run `/ownmemory:onboard` (or `connectors/cursor/scripts/install-local.sh`), `npm install` at repo root, verify `whoAmI`, then only enable extra connectors that match the host. Prefs may still live under `~/.cursor` / `~/.ownmemory`; canonical OwnMemory-owned Cursor slices remain in this repo and are symlinked out.

Never require Mem0/Supermemory cloud accounts as a setup step.

## Versioning

Track releases in `package.json` + `CHANGELOG.md` on version bumps:

| Tier | SemVer | When |
| --- | --- | --- |
| **major** | `X.0.0` | Breaking store, API, or MCP contract |
| **semi-major** | `0.X.0` / `X.Y.0` | Significant capability (new default embedder, new tool surface) |
| **minor** | `X.Y.Z` | Fixes and small compatible improvements |

Bump the matching tier in the same commit that lands the change. Do not leave version bumps for a later housekeeping PR.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
