# OwnMemory embed HTTP sidecar (for Zikron / janet)

Date: 2026-10-20  
Status: **SHIPPED · FEATURE-COMPLETE · FROZEN (OwnMemory 0.4.0)** — Approved 2026-10-20, locked on `main`  
Frozen contract (canonical): [`connectors/zikron-embed/CONTRACT.md`](../../../connectors/zikron-embed/CONTRACT.md)  
Related: zeek repo `docs/superpowers/specs/2026-10-17-zikron-wordpress-design.md`  
Note: For janet embeddings, this doc **supersedes** that file’s preference for Ollama/`snowflake-arctic-embed:33m` as the local path. Prefer this OwnMemory-style HTTP sidecar; keep a single writer geometry for `VECTOR(384)`.

## Frozen product rule (non-negotiable)

`connectors/zikron-embed` is a **fully functional, feature-complete, standalone connector**. It is **its own part**. It **does its job** (HTTP arctic-s → float[384] for Zikron). That job is **done** as of 0.4.0.

- Not a stub, scaffold, spike, or “waiting on janet/WP to be real.”
- Downstream work (Zikron plugin deploy, WPDB wiring, query spaces) is **other parts**. Their absence does **not** make this connector incomplete.
- Within its job it is the stable path that **must not regress**. Protocol errors (400 / `ready: false`) are correct contract behavior.
- **Same engine slot, optional faster backend:** Cypher/cloud for the keyed engine is just faster for the same slot — not a second corpus. No Cypher → slotted engine (arctic-s today; MiniLM/substitute only if that is the key) runs on CPU and Just Works. Upstream down → local CPU still serves.
- Do not redefine or hollow this part. Supersede only with a **major** version and an explicit rewrite of `CONTRACT.md`.

## Purpose

Ship a **tiny, persistent HTTP embedder** that reuses OwnMemory’s on-device arctic-s path (`@xenova/transformers` + quantized ONNX). Zikron on janet calls it over the Compose network and writes `VECTOR(384)` into WordPress/MariaDB. OwnMemory itself stays a simple SQLite engine; this sidecar does **not** turn OwnMemory into a multi-backend store.

## Why this exists

Benchmarks on 2026-10-20 showed Ollama as an embed sidecar costs hundreds of MiB of daemon RAM for little gain on janet, while OwnMemory’s transformers.js arctic-s path is far lighter and already defines the shared 384-d geometry (CLS pooling, Snowflake query prefix on queries only).

Rob’s preference: do not hand-write ONNX; reuse whatever OwnMemory already does.

## Architecture boundary

| Piece | Owns | Does not own |
|-------|------|----------------|
| OwnMemory core | Embed + SQLite stash; bare-bones data scripts | MariaDB, WP, multi-DB query |
| This sidecar | HTTP → float[384] for arctic-s | Persistence, recall, spaces |
| Zikron (WP plugin) | HTTP client + WPDB `VECTOR(384)` + FTS/hybrid | Model weights / ONNX runtime |
| Later (out of scope) | Query spaces across SQLite + MariaDB (+ more); import/export/sync | — |

Shared practical step: **same embedder implementation**. Separate stores stay separate.

```
┌─────────────┐     POST /v1/embed      ┌──────────────────────┐
│  php (WP)   │ ──────────────────────► │  embed (Node sidecar) │
│  Zikron     │ ◄────────────────────── │  arctic-s ONNX ~67MB  │
└──────┬──────┘     float[384]          └──────────┬───────────┘
       │                                           │
       │ VEC_FromText / INSERT                     │ volume: model cache
       v                                           v
┌─────────────┐                          Snowflake/snowflake-arctic-embed-s
│  MariaDB    │
│ VECTOR(384) │
└─────────────┘
```

OwnMemory on Sheila continues to call the same embed library in-process (no requirement that Sheila use this HTTP service).

## Source of truth

Live under the OwnMemory repo:

```
connectors/zikron-embed/
  README.md
  Dockerfile                 # build context = OwnMemory repo root
  docker-compose.fragment.yml
  src/server.ts              # node:http only; imports ../../src/lib/memory/*
```

No separate `package.json` for the sidecar unless needed later — the image installs from the OwnMemory root lockfile so `@xenova/transformers` and embed modules stay one version.

Implementation reuses `src/lib/memory/embedders.ts` and the same pipeline options as `src/lib/memory/embed.ts` (CLS, L2 normalize, query prefix). Do not copy magic strings.

Compose fragment is **dropped into** `/home/ubuntu/work/wp/` (override file or merge into `docker-compose.yml`). Models cache in a named volume so restarts stay warm.

## HTTP API

Internal only (Compose network). No published host port on janet by default.

### `GET /health`

```json
{
  "ok": true,
  "ready": true,
  "engine": "arctic-s",
  "model": "Snowflake/snowflake-arctic-embed-s",
  "dims": 384,
  "pooling": "cls"
}
```

`engine` is the OwnMemory catalog id. **Embeddings and lookups must use the same engine** — key it on the VECTOR corpus / settings; never query with a different engine than was used to write.

`ready: false` while the pipeline is still loading. Always HTTP **200** with the `ready` flag (not 503) so PHP can treat cold start as “keyword-only for now” instead of a hard outage.

### `POST /v1/embed`

Request:

```json
{
  "text": "string",
  "role": "document" | "query"
}
```

- `role: "query"` → prepend `Represent this sentence for searching relevant passages: `
- `role: "document"` → no prefix  
- Empty / missing `text` → `400`

Response:

```json
{
  "embedding": [/* 384 floats */],
  "engine": "arctic-s",
  "model": "Snowflake/snowflake-arctic-embed-s",
  "dims": 384
}
```

Batch (optional v1.1, not required for first cut):

```json
{ "texts": ["..."], "role": "document" }
```

→ `{ "embeddings": [[...], ...], "engine", "model", "dims" }`

No auth in v1 (trusted Compose network). If the service is ever bound to a host port, add a shared secret header before that.

## Compose sketch (janet)

```yaml
services:
  embed:
    build:
      context: /path/to/ownmemory   # repo root
      dockerfile: connectors/zikron-embed/Dockerfile
    image: ownmemory-embed:local
    restart: unless-stopped
    environment:
      EMBED_LISTEN: "0.0.0.0:8791"
      OWNMEMORY_EMBEDDING_MODEL: Snowflake/snowflake-arctic-embed-s
      TRANSFORMERS_CACHE: /data/models
      OWNMEMORY_DATA_DIR: /data
    volumes:
      - embed_models:/data/models
    # no host ports — php uses http://embed:8791
    mem_limit: 512m

  php:
    depends_on:
      - embed
    environment:
      ZIKRON_EMBED_URL: http://embed:8791

volumes:
  embed_models:
```

`mem_limit: 512m` is a starting cap for the Pi (WP stack already ~1.4 GiB); tune after measuring warm RSS with transformers.js on aarch64 (target: clearly below Ollama’s ~800 MiB class).

## Optional cypher GPU path (easy — in scope)

2026-10-20 benches: cypher Ollama GPU `snowflake-arctic-embed:33m` is roughly an order of magnitude faster than janet CPU for batched embeds. janet already reaches `http://cypher:11434` (snap 0.34.0, `*:11434`), and `:33m` is pulled. So using the 3060 for “embeds get done now on the right silicon” is a small HTTP client change, not a new stack.

**Policy:** prefer cypher when it is healthy and vectors match the local sidecar; otherwise use the janet OwnMemory-style sidecar. Never mix incompatible geometries in one `VECTOR(384)` column.

| Order | Backend | URL / model | When |
|-------|---------|-------------|------|
| 1 | Cypher Ollama GPU | `ZIKRON_EMBED_GPU_URL` (default `http://cypher:11434`) + `snowflake-arctic-embed:33m` | Probe OK and interchangeability OK |
| 2 | Janet sidecar | `ZIKRON_EMBED_URL` = `http://embed:8791` | Always the local baseline / fallback |
| — | Keyword / FTS | — | Both embed backends fail |

**Interchangeability gate (once at boot, cache result):** embed a fixed probe sentence on cypher and on the sidecar; require cosine ≥ 0.98 and `dims === 384`. If the gate fails, **stick to the sidecar only** and log which path was locked. Do not alternate writers mid-column.

**Latency probe (optional, cache ~5 minutes):** if both pass the gate, prefer whichever answers a tiny embed faster; on failure of the winner, try the other immediately. If that is too clever for v1, hard-prefer cypher then sidecar.

**Query prefix:** OwnMemory/sidecar apply the Snowflake prefix for `role: "query"`. For Ollama `:33m`, Zikron must apply the **same** prefix string before calling `/api/embed` when embedding queries (documents: no prefix), so geometry stays aligned.

**Not in the sidecar process:** the Node service does not proxy to cypher. Routing lives in Zikron PHP (or a tiny future router). Sidecar stays dumb and local.

Set `ZIKRON_EMBED_GPU_URL=` empty to disable GPU and use sidecar only (e.g. cypher down for maintenance).

## Zikron client (PHP) — contract only

`Zikron_Embed::document($text)` / `::query($text)`:

1. Choose backend per the table above
2. Sidecar: `POST {ZIKRON_EMBED_URL}/v1/embed` with `{ text, role }`
3. Cypher: `POST {ZIKRON_EMBED_GPU_URL}/api/embed` with `{ model: "snowflake-arctic-embed:33m", input }` (prefix already applied for queries)
4. Validate `dims === 384` / length 384
5. On total failure → return `null`; memory layer keeps keyword/FTS (same as OwnMemory when embed fails)

Do **not** load ONNX inside PHP. Do **not** run Ollama on janet for embeddings (sidecar replaces that).

## OwnMemory core — non-goals

- No MariaDB driver in OwnMemory
- No “query space” orchestrator in this slice
- No change to SQLite schema required for the sidecar
- Sidecar is a connector, like Cursor/OpenClaw: optional for OwnMemory users who only want MCP/SQLite

## Success criteria

### Connector job (SHIPPED / satisfied at 0.4.0)

1. ~~Sidecar serves `/health` with `dims: 384`~~ — satisfied (`npm run embed-http` + Docker path)
2. ~~Same input → OwnMemory in-process arctic-s and sidecar cosine ≥ 0.99~~ — measured **1.0**
3. ~~Cypher `:33m` vs sidecar cosine ≥ 0.98 (or GPU path disabled)~~ — measured **~0.992**
4. ~~`npm run test:embed-http` green~~ — **4/4**
5. PHP reference client + compose fragment + probe scripts present under `connectors/zikron-embed/`

### Consumer / ops (other parts — do not reopen connector completeness)

6. janet `docker compose up -d embed` on the live WP stack (deploy step)
7. Zikron plugin on janet saves non-NULL `VECTOR(384)` via this sidecar (zeek/WP work)
8. Sidecar RSS vs Ollama on janet after deploy measurement
9. Live routing: cypher up → prefer GPU; cypher down → sidecar still serves

Criteria 6–9 are **integration of a finished connector**, not missing features of this part.

## Out of scope

- Cross-database query spaces / federated recall
- Import/export/sync between OwnMemory SQLite and WPDB
- Arctic-L / `:335m` / 1024-d for Zikron’s VECTOR(384) column
- CUDA EP inside the Node sidecar
- Publishing the sidecar on a public interface
- Replacing OwnMemory’s in-process embedder with HTTP on Sheila
- Ollama-on-janet for embeddings
- Any claim that this connector is incomplete until those land

## Open points (ops / other parts only — connector contract closed)

- Image distribution: build on janet from a git checkout vs multi-arch image from CI
- Exact `mem_limit` after measuring warm RSS on aarch64
- How Zikron plugin source is deployed onto janet relative to this sidecar (zeek)
- Hard-prefer cypher vs 5-minute latency probe for picking the winner (PHP client policy)
