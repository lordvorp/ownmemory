# Changelog

Versions live in `package.json`. Bump on **major**, **semi-major**, and **minor** release commits (see [AGENTS.md](AGENTS.md)).

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
