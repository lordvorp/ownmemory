# Changelog

Versions live in `package.json`. Bump on **major**, **semi-major**, and **minor** release commits (see [AGENTS.md](AGENTS.md)).

## 0.4.1 — 2026-10-21

### Minor

- zikron-embed: health and `/v1/embed` responses include stable `engine` catalog id (`arctic-s`). Embeddings and lookups must share that key (CONTRACT invariant).

## 0.4.0 — 2026-10-20

### Semi-major

- New connector `connectors/zikron-embed`: HTTP sidecar reusing OwnMemory arctic-s embeddings for Zikron/WordPress (`GET /health`, `POST /v1/embed`).
- Docker + compose fragment for janet; PHP reference client with optional cypher GPU (`snowflake-arctic-embed:33m`) gated by cosine interchangeability.
- `npm run embed-http` / `npm run test:embed-http`.
- **Frozen completeness:** this connector is a finished standalone part (see `connectors/zikron-embed/CONTRACT.md`). Downstream Zikron/janet deploy does not reopen it as incomplete. Local-only arctic-s always works; upstream GPU/inference is optional only.

## 0.3.1 — 2026-10-20

### Minor

- Arctic-L is **CUDA-required**: onnxruntime CUDA EP + enough free VRAM, or selection/re-embed falls back to Arctic-S (CPU-only ORT and low-VRAM GPUs like Quadro M1000M refuse cleanly).
- `whoAmI` / settings snapshot report `embedDevice`, `requestedEmbedderId`, and `gpuFallbackReason`.
- `npm run reembed` prints device status and refuses a GPU-role re-embed when CUDA is unavailable.
- Escape hatch: `OWNMEMORY_ALLOW_GPU_CPU=1` allows Arctic-L on CPU for experiments.

## 0.3.0 — 2026-10-19

### Semi-major (compatible)

- Additive MCP/HTTP memory ops: `get_memory`, `update_memory`, `delete_memory`, `list_memories` (existing `memory` / `recall` / `whoAmI` / `listSpaces` unchanged).
- Optional memory metadata columns: `meta_type`, `pinned`, `branch`, `meta_json` (NULL/0 on old rows).
- Embedder catalog + GUI radio: **arctic-s** (default, ~67MB), **minilm** (fallback, ~23MB), **arctic-l** (GPU, ~669MB FP16). Stored in `~/.ownmemory/settings.json`; env `OWNMEMORY_EMBEDDING_MODEL` still overrides.
- Infer settings stub (`mode: off | local | openai_compatible | cloud`) reserved — not used yet.
- Changing embedder sets `reembedRequired`; run `npm run reembed` then reload MCP.

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
