# Changelog

Versions live in `package.json`. Bump on **major**, **semi-major**, and **minor** release commits (see [AGENTS.md](AGENTS.md)).

## 0.2.1 — 2026-10-19

### Minor

- OwnMemory-owned Cursor home slices live under `.cursor-home/` and symlink into `~/.cursor` (`mcp.json`, hooks, Mem0-routing rule).
- New Cursor plugin package at `connectors/cursor/` (manifest, stdio MCP wrapper, hooks, skills, `install-local.sh`) for GUI install/enable like marketplace plugins.
- Agent notes cover cold systems and optional connectors (Cursor / OpenClaw / Open WebUI) as install-time plugins.
- Added [`docs/mem0-cursor-plugin-report.md`](docs/mem0-cursor-plugin-report.md) from the local Mem0 plugin cache.

## 0.2.0 — 2026-10-19

### Semi-major

- Default embedder is now `Snowflake/snowflake-arctic-embed-s` (CLS pooling, L2 normalize, arctic query prefix on recall/forget only).
- `OWNMEMORY_DATA_DIR` defaults to `~/.ownmemory` with home (`~`) expansion when set or when falling back.
- `OWNMEMORY_EMBEDDING_MODEL` still overrides; unset uses the arctic default.
- Added `npm run reembed` to rewrite stored vectors after an embedder change.
- `whoAmI` reports `version`.

### Migration

After upgrading from 0.1.x MiniLM embeddings, run `npm run reembed` against your data directory (or an equivalent re-embed) before relying on semantic recall.

## 0.1.0 — 2026-10-17

- Initial OwnMemory engine: SQLite + FTS5, MiniLM embeddings, MCP tools, web console.
