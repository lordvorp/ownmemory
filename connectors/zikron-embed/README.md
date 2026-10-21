# Zikron embed HTTP sidecar

**SHIPPED · FEATURE-COMPLETE · STANDALONE** (OwnMemory 0.4.0). Frozen contract: [`CONTRACT.md`](./CONTRACT.md) — this connector is its own finished part; it does the embed job and that job does not get reopened as “incomplete.”

Tiny HTTP service that exposes OwnMemory’s on-device **Snowflake/snowflake-arctic-embed-s** path (`@xenova/transformers`, CLS pooling, L2-normalized **384**-dim vectors). Zikron on janet calls it over Docker Compose and writes `VECTOR(384)` into MariaDB.

Design spec: [`docs/superpowers/specs/2026-10-20-zikron-embed-sidecar-design.md`](../../docs/superpowers/specs/2026-10-20-zikron-embed-sidecar-design.md). PHP client reference: zeek repo Zikron embed routing (see design spec “Optional cypher GPU path” and plan task 5).

## HTTP API

Internal only (Compose network). Default: no host port on janet.

### `GET /health`

Returns HTTP 200 always; use `ready` for cold start:

```json
{
  "ok": true,
  "ready": true,
  "model": "Snowflake/snowflake-arctic-embed-s",
  "dims": 384,
  "pooling": "cls"
}
```

### `POST /v1/embed`

Request:

```json
{ "text": "string", "role": "document" | "query" }
```

- `role: "query"` — Snowflake search prefix applied server-side.
- `role: "document"` — no prefix.
- Missing/empty `text` → `400`.

Response:

```json
{
  "embedding": [/* 384 floats */],
  "model": "Snowflake/snowflake-arctic-embed-s",
  "dims": 384
}
```

## Local development

From the OwnMemory repo root:

```bash
npm install
npm run embed-http
```

Default listen: `0.0.0.0:8791` (`EMBED_LISTEN`). Tests: `npm run test:embed-http`.

## Docker build

Build context **must** be the OwnMemory repo root (lockfile + `src/lib/memory/*`):

```bash
cd /path/to/ownmemory
docker build -f connectors/zikron-embed/Dockerfile -t ownmemory-embed:local .
```

Run (example smoke on a dev machine):

```bash
docker run --rm -d --name om-embed-smoke -p 127.0.0.1:18791:8791 \
  -v om-embed-models:/data/models ownmemory-embed:local
curl -s http://127.0.0.1:18791/health
curl -s -X POST http://127.0.0.1:18791/v1/embed \
  -H 'content-type: application/json' \
  -d '{"text":"hello","role":"document"}'
docker rm -f om-embed-smoke
```

## Janet / WordPress stack

1. Copy or merge [`docker-compose.fragment.yml`](./docker-compose.fragment.yml) into `/home/ubuntu/work/wp/docker-compose.yml` (or use a second file: `docker compose -f docker-compose.yml -f docker-compose.embed.yml up -d`).
2. Set `build.context` to your OwnMemory checkout on janet (default in fragment: `/home/ubuntu/work/ownmemory`).
3. Ensure the `php` service picks up embed env (fragment adds `depends_on: embed` and URLs below).

Named volume `embed_models` caches ONNX under `/data/models` (`TRANSFORMERS_CACHE`).

## Environment variables

| Variable | Default (image) | Purpose |
|----------|-----------------|--------|
| `EMBED_LISTEN` | `0.0.0.0:8791` | Bind host:port |
| `OWNMEMORY_EMBEDDING_MODEL` | `Snowflake/snowflake-arctic-embed-s` | HF model id |
| `OWNMEMORY_DATA_DIR` | `/data` | OwnMemory data root |
| `TRANSFORMERS_CACHE` | `/data/models` | Model cache directory |

**Zikron (PHP) — not read by this container:**

| Variable | Typical value | Purpose |
|----------|---------------|--------|
| `ZIKRON_EMBED_URL` | `http://embed:8791` | Janet sidecar (baseline / fallback) |
| `ZIKRON_EMBED_GPU_URL` | `http://cypher:11434` | Optional Ollama GPU on cypher; set empty to disable |

Routing policy (GPU vs sidecar vs keyword-only) lives in Zikron PHP, not in this service. See the design spec.
