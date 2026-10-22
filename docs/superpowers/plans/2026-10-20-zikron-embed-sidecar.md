# Zikron embed HTTP sidecar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a tiny OwnMemory-rooted HTTP embedder (`connectors/zikron-embed`) that serves arctic-s 384-d vectors for Zikron on janet, with documented Compose wiring and a PHP reference client that can prefer cypher GPU Ollama when interchangeable.

**Architecture:** Node `node:http` server reuses `src/lib/memory/embed.ts` / `embedders.ts` (CLS, L2 normalize, Snowflake query prefix). Docker build context is the OwnMemory repo root. Zikron routing (cypher `:33m` → sidecar fallback) lives in PHP, not inside the Node process. OwnMemory SQLite core stays unchanged.

**Tech Stack:** Node 20+, TypeScript via `tsx`, `@xenova/transformers` (existing), Docker multi-arch (`linux/arm64` for janet), PHP 8 reference client (no Composer).

## Global Constraints

- License: MIT.
- Default model: `Snowflake/snowflake-arctic-embed-s` (384-d, quantized ONNX, CLS, query prefix only for `role=query`).
- Sidecar API: `GET /health` always HTTP 200 with `ready` boolean; `POST /v1/embed` with `{ text, role }`.
- No host port published on janet by default; php reaches `http://embed:8791`.
- No MariaDB / multi-DB inside OwnMemory core.
- No Ollama-on-janet for embeddings; optional GPU is cypher only (`snowflake-arctic-embed:33m`).
- Interchangeability: cypher vs sidecar cosine ≥ 0.98 on a fixed probe before enabling GPU path.
- Version bump: **0.4.0** semi-major (new connector surface) in the same commit that lands the sidecar.
- Do not start Sheila Docker `ollama-gpu` for this work (suspend/nvidia-sleep issue).

## File map

| Path | Responsibility |
|------|----------------|
| `connectors/zikron-embed/src/server.ts` | HTTP server + injectable embed function |
| `connectors/zikron-embed/src/server.test.ts` | Unit tests (fake embedder; no model download) |
| `connectors/zikron-embed/src/run.ts` | Process entry: real `embedText`, listen, warm |
| `connectors/zikron-embed/Dockerfile` | Image from repo root |
| `connectors/zikron-embed/docker-compose.fragment.yml` | Drop-in for janet `wp` |
| `connectors/zikron-embed/README.md` | Build, run, Zikron env vars |
| `connectors/zikron-embed/php/Zikron_Embed.php` | Reference PHP client (GPU + sidecar + probe) |
| `connectors/zikron-embed/scripts/probe-interchange.mjs` | Cosine gate: OwnMemory vs sidecar vs optional cypher |
| `package.json` | `embed-http` script + version `0.4.0` |
| `CHANGELOG.md` | 0.4.0 notes |
| `AGENTS.md` | One line pointing at the connector |

**Follow-up (not this plan):** wire `Zikron_Embed.php` into `/home/rob/work/zeek/plugins/zikron` and janet Compose deploy — separate zeek plan once the plugin tree exists.

---

### Task 1: HTTP server with injectable embedder (TDD)

**Files:**
- Create: `connectors/zikron-embed/src/server.ts`
- Create: `connectors/zikron-embed/src/server.test.ts`
- Modify: `package.json` (add test script for this package)

**Interfaces:**
- Consumes: none from other tasks
- Produces:
  - `export type EmbedRole = "document" | "query"`
  - `export type EmbedFn = (text: string, role: EmbedRole) => Promise<Float32Array>`
  - `export type HealthInfo = { model: string; dims: number; pooling: string }`
  - `export function createEmbedServer(opts: { embed: EmbedFn; health: HealthInfo; isReady: () => boolean; }): import("node:http").Server`
  - Server handles `GET /health`, `POST /v1/embed`; other paths `404`; bad JSON / missing text `400`

- [ ] **Step 1: Write the failing test**

Create `connectors/zikron-embed/src/server.test.ts`:

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmbedServer } from "./server.ts";

function listen(server: import("node:http").Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("no port"));
        return;
      }
      resolve(`http://127.0.0.1:${addr.port}`);
    });
  });
}

describe("createEmbedServer", () => {
  it("health returns ready flag and dims", async () => {
    let ready = false;
    const server = createEmbedServer({
      embed: async () => new Float32Array(384),
      health: { model: "Snowflake/snowflake-arctic-embed-s", dims: 384, pooling: "cls" },
      isReady: () => ready,
    });
    const base = await listen(server);
    try {
      const cold = await fetch(`${base}/health`).then((r) => r.json());
      assert.equal(cold.ok, true);
      assert.equal(cold.ready, false);
      assert.equal(cold.dims, 384);
      ready = true;
      const hot = await fetch(`${base}/health`).then((r) => r.json());
      assert.equal(hot.ready, true);
    } finally {
      server.close();
    }
  });

  it("embed returns 384 floats and passes role", async () => {
    const roles: string[] = [];
    const server = createEmbedServer({
      embed: async (text, role) => {
        roles.push(role);
        const v = new Float32Array(384);
        v[0] = text.length;
        return v;
      },
      health: { model: "Snowflake/snowflake-arctic-embed-s", dims: 384, pooling: "cls" },
      isReady: () => true,
    });
    const base = await listen(server);
    try {
      const res = await fetch(`${base}/v1/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "cats", role: "query" }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.dims, 384);
      assert.equal(body.embedding.length, 384);
      assert.equal(body.embedding[0], 4);
      assert.deepEqual(roles, ["query"]);
    } finally {
      server.close();
    }
  });

  it("rejects empty text with 400", async () => {
    const server = createEmbedServer({
      embed: async () => new Float32Array(384),
      health: { model: "x", dims: 384, pooling: "cls" },
      isReady: () => true,
    });
    const base = await listen(server);
    try {
      const res = await fetch(`${base}/v1/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "  ", role: "document" }),
      });
      assert.equal(res.status, 400);
    } finally {
      server.close();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/rob/work/ownmemory && node --import tsx --test connectors/zikron-embed/src/server.test.ts`

Expected: FAIL (cannot find module `./server.ts` or `createEmbedServer` not exported)

- [ ] **Step 3: Write minimal implementation**

Create `connectors/zikron-embed/src/server.ts`:

```typescript
/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 */

import http from "node:http";

export type EmbedRole = "document" | "query";
export type EmbedFn = (text: string, role: EmbedRole) => Promise<Float32Array>;
export type HealthInfo = { model: string; dims: number; pooling: string };

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
  });
  res.end(json);
}

export function createEmbedServer(opts: {
  embed: EmbedFn;
  health: HealthInfo;
  isReady: () => boolean;
}): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://embed.local");
      if (req.method === "GET" && url.pathname === "/health") {
        send(res, 200, {
          ok: true,
          ready: opts.isReady(),
          model: opts.health.model,
          dims: opts.health.dims,
          pooling: opts.health.pooling,
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/embed") {
        const body = (await readJson(req)) as { text?: unknown; role?: unknown };
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text) {
          send(res, 400, { error: "text is required" });
          return;
        }
        const role: EmbedRole = body.role === "query" ? "query" : "document";
        const vec = await opts.embed(text, role);
        send(res, 200, {
          embedding: Array.from(vec),
          model: opts.health.model,
          dims: opts.health.dims,
        });
        return;
      }
      send(res, 404, { error: "not found" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      send(res, 500, { error: msg });
    }
  });
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `cd /home/rob/work/ownmemory && node --import tsx --test connectors/zikron-embed/src/server.test.ts`

Expected: PASS (3 tests)

- [ ] **Step 5: Add npm script and commit**

In root `package.json` scripts, add:

```json
"embed-http": "tsx connectors/zikron-embed/src/run.ts",
"test:embed-http": "node --import tsx --test connectors/zikron-embed/src/server.test.ts"
```

```bash
git add connectors/zikron-embed/src/server.ts connectors/zikron-embed/src/server.test.ts package.json
git commit -m "$(cat <<'EOF'
feat: add zikron-embed HTTP server with injectable embedder

EOF
)"
```

---

### Task 2: Process entry wired to OwnMemory `embedText`

**Files:**
- Create: `connectors/zikron-embed/src/run.ts`

**Interfaces:**
- Consumes: `createEmbedServer` from Task 1; `embedText`, `warmEmbeddings`, `isEmbeddingReady`, `getActiveEmbedderProfile` from `../../../src/lib/memory/embed.ts` (path relative to `connectors/zikron-embed/src`)
- Produces: listening process on `EMBED_LISTEN` (default `0.0.0.0:8791`); sets `OWNMEMORY_DATA_DIR` default `/data` when unset in container

- [ ] **Step 1: Write `run.ts`**

```typescript
/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 */

import {
  embedText,
  getActiveEmbedderProfile,
  isEmbeddingReady,
  warmEmbeddings,
} from "../../../src/lib/memory/embed.ts";
import { createEmbedServer } from "./server.ts";

const listen = process.env.EMBED_LISTEN?.trim() || "0.0.0.0:8791";
const [host, portStr] = listen.includes(":")
  ? (listen.split(":") as [string, string])
  : ["0.0.0.0", listen];
const port = Number(portStr);
if (!Number.isFinite(port)) {
  console.error(`invalid EMBED_LISTEN=${listen}`);
  process.exit(1);
}

const profile = getActiveEmbedderProfile();
const server = createEmbedServer({
  embed: (text, role) => embedText(text, role),
  health: {
    model: profile.hfModel,
    dims: profile.dims,
    pooling: profile.pooling,
  },
  isReady: () => isEmbeddingReady(),
});

warmEmbeddings();

server.listen(port, host, () => {
  console.log(
    `ownmemory-embed listening on http://${host}:${port} model=${profile.hfModel} dims=${profile.dims}`,
  );
});
```

- [ ] **Step 2: Smoke listen locally (arctic-s already cached under ~/.ownmemory)**

Run:

```bash
cd /home/rob/work/ownmemory
OWNMEMORY_EMBEDDING_MODEL=Snowflake/snowflake-arctic-embed-s \
  timeout 45s npm run embed-http
```

In another shell (while server up), or use a one-shot:

```bash
cd /home/rob/work/ownmemory
OWNMEMORY_EMBEDDING_MODEL=Snowflake/snowflake-arctic-embed-s \
  npx tsx -e '
import { spawn } from "node:child_process";
const child = spawn("npx", ["tsx", "connectors/zikron-embed/src/run.ts"], {
  env: { ...process.env, EMBED_LISTEN: "127.0.0.1:18791", OWNMEMORY_EMBEDDING_MODEL: "Snowflake/snowflake-arctic-embed-s" },
  stdio: ["ignore", "pipe", "pipe"],
});
await new Promise((r) => setTimeout(r, 8000));
const h = await fetch("http://127.0.0.1:18791/health").then((r) => r.json());
console.log(h);
const e = await fetch("http://127.0.0.1:18791/v1/embed", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ text: "Zikron embedder check", role: "document" }),
}).then((r) => r.json());
console.log({ dims: e.dims, n: e.embedding?.length, head: e.embedding?.slice(0, 3) });
child.kill("SIGTERM");
if (e.dims !== 384 || e.embedding?.length !== 384) process.exit(1);
'
```

Expected: `dims: 384`, health eventually `ready: true` (may be false for first few seconds).

- [ ] **Step 3: Commit**

```bash
git add connectors/zikron-embed/src/run.ts
git commit -m "$(cat <<'EOF'
feat: wire zikron-embed server to OwnMemory embedText

EOF
)"
```

---

### Task 3: Dockerfile, compose fragment, README

**Files:**
- Create: `connectors/zikron-embed/Dockerfile`
- Create: `connectors/zikron-embed/docker-compose.fragment.yml`
- Create: `connectors/zikron-embed/README.md`

**Interfaces:**
- Consumes: Task 2 entrypoint
- Produces: buildable image `ownmemory-embed:local`; compose service name `embed`

- [ ] **Step 1: Dockerfile (build context = repo root)**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY tsconfig.json ./
COPY src ./src
COPY connectors/zikron-embed ./connectors/zikron-embed
ENV OWNMEMORY_DATA_DIR=/data
ENV TRANSFORMERS_CACHE=/data/models
ENV EMBED_LISTEN=0.0.0.0:8791
ENV OWNMEMORY_EMBEDDING_MODEL=Snowflake/snowflake-arctic-embed-s
EXPOSE 8791
CMD ["npx", "tsx", "connectors/zikron-embed/src/run.ts"]
```

Note: if `npm ci --omit=dev` omits `tsx`, either keep `tsx` as a production dependency for this image or change CMD to `node --import tsx/...` after `npm ci` without omit, or compile to JS. **Preferred:** use `npm ci` (with devDeps) in the image for simplicity, or add a small compile step. Implementer: if `tsx` missing at runtime, switch Dockerfile to `RUN npm ci` (include devDeps) — acceptable for private arm64 image size vs complexity.

- [ ] **Step 2: compose fragment**

```yaml
# Merge into /home/ubuntu/work/wp/docker-compose.yml or use:
#   docker compose -f docker-compose.yml -f docker-compose.embed.yml up -d
services:
  embed:
    build:
      context: /home/ubuntu/work/ownmemory   # adjust to checkout path on janet
      dockerfile: connectors/zikron-embed/Dockerfile
    image: ownmemory-embed:local
    restart: unless-stopped
    environment:
      EMBED_LISTEN: "0.0.0.0:8791"
      OWNMEMORY_EMBEDDING_MODEL: Snowflake/snowflake-arctic-embed-s
      OWNMEMORY_DATA_DIR: /data
      TRANSFORMERS_CACHE: /data/models
    volumes:
      - embed_models:/data/models
    mem_limit: 512m

  php:
    depends_on:
      - embed
    environment:
      ZIKRON_EMBED_URL: http://embed:8791
      ZIKRON_EMBED_GPU_URL: http://cypher:11434

volumes:
  embed_models:
```

- [ ] **Step 3: README**

Document: purpose, API, local `npm run embed-http`, Docker build command, janet merge steps, env vars (`ZIKRON_EMBED_URL`, `ZIKRON_EMBED_GPU_URL`), pointer to design spec and PHP reference.

- [ ] **Step 4: Build image on Sheila (amd64 smoke)**

```bash
cd /home/rob/work/ownmemory
docker build -f connectors/zikron-embed/Dockerfile -t ownmemory-embed:local .
docker run --rm -d --name om-embed-smoke -p 127.0.0.1:18791:8791 \
  -v om-embed-models:/data/models ownmemory-embed:local
# wait, curl health + embed, then:
docker rm -f om-embed-smoke
```

Expected: health `dims: 384`; embed length 384.

- [ ] **Step 5: Commit**

```bash
git add connectors/zikron-embed/Dockerfile connectors/zikron-embed/docker-compose.fragment.yml connectors/zikron-embed/README.md
git commit -m "$(cat <<'EOF'
feat: Docker packaging for zikron-embed sidecar

EOF
)"
```

---

### Task 4: Interchangeability probe script

**Files:**
- Create: `connectors/zikron-embed/scripts/probe-interchange.mjs`

**Interfaces:**
- Consumes: running sidecar URL; optional cypher Ollama; local in-process via child `tsx` or HTTP-only mode
- Produces: exit 0 if sidecar↔OwnMemory ≥ 0.99 and (if `CYPHER_URL` set) cypher↔sidecar ≥ 0.98; prints JSON summary

- [ ] **Step 1: Implement probe**

```javascript
#!/usr/bin/env node
/**
 * Probe vector interchangeability for Zikron embed routing.
 * Usage:
 *   SIDECAR_URL=http://127.0.0.1:18791 node --import tsx connectors/zikron-embed/scripts/probe-interchange.mjs
 *   CYPHER_URL=http://cypher:11434 SIDECAR_URL=... node --import tsx ...
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const PROBE = "Zikron embedder check";
const SIDECAR = (process.env.SIDECAR_URL || "http://127.0.0.1:8791").replace(/\/$/, "");
const CYPHER = (process.env.CYPHER_URL || "").replace(/\/$/, "");
const PREFIX = "Represent this sentence for searching relevant passages: ";

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function sidecarEmbed(text, role) {
  const r = await fetch(`${SIDECAR}/v1/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, role }),
  });
  if (!r.ok) throw new Error(`sidecar ${r.status}`);
  const j = await r.json();
  return j.embedding;
}

async function cypherEmbed(text, role) {
  const input = role === "query" ? PREFIX + text : text;
  const r = await fetch(`${CYPHER}/api/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "snowflake-arctic-embed:33m", input }),
  });
  if (!r.ok) throw new Error(`cypher ${r.status}`);
  const j = await r.json();
  const emb = j.embeddings?.[0] ?? j.embedding;
  if (!emb) throw new Error("cypher: no embedding");
  return emb;
}

async function localEmbed(text, role) {
  const code = `
    import { embedText } from "./src/lib/memory/embed.ts";
    const v = await embedText(${JSON.stringify(text)}, ${JSON.stringify(role)});
    process.stdout.write(JSON.stringify(Array.from(v)));
  `;
  const child = spawn("npx", ["tsx", "-e", code], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      OWNMEMORY_EMBEDDING_MODEL: "Snowflake/snowflake-arctic-embed-s",
    },
  });
  let out = "", err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  const codeExit = await new Promise((res) => child.on("close", res));
  if (codeExit !== 0) throw new Error(`local embed failed: ${err}`);
  return JSON.parse(out);
}

const sideDoc = await sidecarEmbed(PROBE, "document");
const localDoc = await localEmbed(PROBE, "document");
const sideLocal = cosine(sideDoc, localDoc);
const summary = {
  probe: PROBE,
  sidecarVsLocal: sideLocal,
  sidecarVsCypher: null,
  okSidecarLocal: sideLocal >= 0.99,
  okCypher: null,
};
if (CYPHER) {
  const cDoc = await cypherEmbed(PROBE, "document");
  summary.sidecarVsCypher = cosine(sideDoc, cDoc);
  summary.okCypher = summary.sidecarVsCypher >= 0.98;
}
console.log(JSON.stringify(summary, null, 2));
if (!summary.okSidecarLocal) process.exit(2);
if (CYPHER && !summary.okCypher) process.exit(3);
```


- [ ] **Step 2: Run against local smoke server from Task 2/3**

```bash
SIDECAR_URL=http://127.0.0.1:18791 node --import tsx connectors/zikron-embed/scripts/probe-interchange.mjs
# optional:
SIDECAR_URL=http://127.0.0.1:18791 CYPHER_URL=http://cypher:11434 node --import tsx connectors/zikron-embed/scripts/probe-interchange.mjs
```

Expected: `okSidecarLocal: true`. Cypher gate may pass or fail — if fail, document in README that GPU path stays disabled until investigated (do not weaken threshold).

- [ ] **Step 3: Commit**

```bash
git add connectors/zikron-embed/scripts/probe-interchange.mjs
git commit -m "$(cat <<'EOF'
feat: add embed interchangeability probe for sidecar and cypher

EOF
)"
```

---

### Task 5: PHP reference client (GPU + sidecar)

**Files:**
- Create: `connectors/zikron-embed/php/Zikron_Embed.php`
- Create: `connectors/zikron-embed/php/zikron_embed_smoke.php` (CLI smoke without WordPress)

**Interfaces:**
- Consumes: sidecar `/v1/embed`, cypher `/api/embed`
- Produces:
  - `Zikron_Embed::document(string $text): ?array`
  - `Zikron_Embed::query(string $text): ?array`
  - `Zikron_Embed::probeAndLock(): void` — runs gate once; sets static `$useGpu`
  - Env: `ZIKRON_EMBED_URL`, `ZIKRON_EMBED_GPU_URL` (empty disables GPU)

- [ ] **Step 1: Implement `Zikron_Embed.php`**

```php
<?php
/**
 * Reference Zikron embed client — OwnMemory sidecar + optional cypher GPU.
 * Licensed under the MIT License. Copy into the Zikron plugin and replace file_get_contents
 * with wp_remote_post when inside WordPress.
 */
declare(strict_types=1);

final class Zikron_Embed
{
    private const PREFIX = 'Represent this sentence for searching relevant passages: ';
    private const PROBE = 'Zikron embedder check';
    private const DIMS = 384;

    /** @var bool|null null = not probed yet */
    private static ?bool $useGpu = null;

    public static function document(string $text): ?array
    {
        return self::embed($text, 'document');
    }

    public static function query(string $text): ?array
    {
        return self::embed($text, 'query');
    }

    public static function probeAndLock(): void
    {
        if (self::$useGpu !== null) {
            return;
        }
        $gpuBase = getenv('ZIKRON_EMBED_GPU_URL') ?: '';
        if ($gpuBase === '') {
            self::$useGpu = false;
            return;
        }
        $side = self::callSidecar(self::PROBE, 'document');
        $gpu = self::callCypher(self::PROBE, 'document');
        if ($side === null || $gpu === null) {
            self::$useGpu = false;
            return;
        }
        self::$useGpu = self::cosine($side, $gpu) >= 0.98;
    }

    private static function embed(string $text, string $role): ?array
    {
        self::probeAndLock();
        if (self::$useGpu) {
            $v = self::callCypher($text, $role);
            if ($v !== null) {
                return $v;
            }
        }
        return self::callSidecar($text, $role);
    }

    private static function callSidecar(string $text, string $role): ?array
    {
        $base = rtrim(getenv('ZIKRON_EMBED_URL') ?: 'http://embed:8791', '/');
        $payload = json_encode(['text' => $text, 'role' => $role]);
        $raw = self::httpPost($base . '/v1/embed', $payload);
        if ($raw === null) {
            return null;
        }
        $j = json_decode($raw, true);
        if (!is_array($j) || !isset($j['embedding']) || !is_array($j['embedding'])) {
            return null;
        }
        if (count($j['embedding']) !== self::DIMS) {
            return null;
        }
        return array_map('floatval', $j['embedding']);
    }

    private static function callCypher(string $text, string $role): ?array
    {
        $base = rtrim(getenv('ZIKRON_EMBED_GPU_URL') ?: '', '/');
        if ($base === '') {
            return null;
        }
        $input = $role === 'query' ? self::PREFIX . $text : $text;
        $payload = json_encode([
            'model' => 'snowflake-arctic-embed:33m',
            'input' => $input,
        ]);
        $raw = self::httpPost($base . '/api/embed', $payload);
        if ($raw === null) {
            return null;
        }
        $j = json_decode($raw, true);
        $emb = $j['embeddings'][0] ?? $j['embedding'] ?? null;
        if (!is_array($emb) || count($emb) !== self::DIMS) {
            return null;
        }
        return array_map('floatval', $emb);
    }

    private static function httpPost(string $url, string $json): ?string
    {
        $ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\n",
                'content' => $json,
                'timeout' => 60,
                'ignore_errors' => true,
            ],
        ]);
        $raw = @file_get_contents($url, false, $ctx);
        return $raw === false ? null : $raw;
    }

    /** @param list<float> $a @param list<float> $b */
    private static function cosine(array $a, array $b): float
    {
        $dot = 0.0;
        $na = 0.0;
        $nb = 0.0;
        $n = min(count($a), count($b));
        for ($i = 0; $i < $n; $i++) {
            $dot += $a[$i] * $b[$i];
            $na += $a[$i] * $a[$i];
            $nb += $b[$i] * $b[$i];
        }
        if ($na <= 0.0 || $nb <= 0.0) {
            return 0.0;
        }
        return $dot / (sqrt($na) * sqrt($nb));
    }
}
```

- [ ] **Step 2: CLI smoke (sidecar only)**

```php
<?php
// connectors/zikron-embed/php/zikron_embed_smoke.php
require __DIR__ . '/Zikron_Embed.php';
putenv('ZIKRON_EMBED_URL=http://127.0.0.1:18791');
putenv('ZIKRON_EMBED_GPU_URL='); // force sidecar
$v = Zikron_Embed::document('Zikron embedder check');
if ($v === null || count($v) !== 384) {
    fwrite(STDERR, "embed failed\n");
    exit(1);
}
echo "ok dims=" . count($v) . "\n";
```

Run with sidecar up: `php connectors/zikron-embed/php/zikron_embed_smoke.php`

Expected: `ok dims=384`

- [ ] **Step 3: Commit**

```bash
git add connectors/zikron-embed/php
git commit -m "$(cat <<'EOF'
feat: add PHP reference client for zikron-embed routing

EOF
)"
```

---

### Task 6: Version 0.4.0, changelog, agent notes

**Files:**
- Modify: `package.json` (version `0.4.0`)
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md` (connector table / one line)
- Modify: `connectors/cursor/.cursor-plugin/plugin.json` only if it embeds package version — check and bump if present

**Interfaces:**
- Consumes: Tasks 1–5 delivered
- Produces: release metadata aligned with AGENTS.md versioning

- [ ] **Step 1: CHANGELOG entry**

```markdown
## 0.4.0 — 2026-10-20

### Semi-major

- New connector `connectors/zikron-embed`: HTTP sidecar reusing OwnMemory arctic-s embeddings for Zikron/WordPress (`GET /health`, `POST /v1/embed`).
- Docker + compose fragment for janet; PHP reference client with optional cypher GPU (`snowflake-arctic-embed:33m`) gated by cosine interchangeability.
- `npm run embed-http` / `npm run test:embed-http`.
```

- [ ] **Step 2: Bump `package.json` to `0.4.0`; update AGENTS.md connector blurb**

Add under connectors table something like:

`| Zikron embed HTTP | `connectors/zikron-embed` | WordPress/Zikron on janet needs on-box arctic-s |`

- [ ] **Step 3: Run unit tests once more**

```bash
npm run test:embed-http
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package.json CHANGELOG.md AGENTS.md connectors/cursor/.cursor-plugin/plugin.json
git commit -m "$(cat <<'EOF'
chore: release 0.4.0 with zikron-embed sidecar connector

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| HTTP `/health` + `/v1/embed` | 1, 2 |
| Reuse OwnMemory arctic-s path | 2 |
| Source under `connectors/zikron-embed`, build from repo root | 3 |
| Compose fragment, no host port, mem_limit | 3 |
| Cypher GPU optional + cosine gate | 4, 5 |
| PHP client contract | 5 |
| OwnMemory core non-goals (no MariaDB) | all (no core store changes) |
| Success: sidecar vs in-process ≥ 0.99 | 4 |
| Success: cypher gate ≥ 0.98 or disable | 4, 5 |
| Out of scope: sync / query spaces / arctic-l | omitted |
| Version bump | 6 |

## Placeholder / consistency self-review

- Fixed: Dockerfile tsx/devDep note is explicit (not a vague TODO).
- PHP uses same PREFIX string as `ARCTIC_QUERY_PREFIX` in embedders.ts.
- Service name `embed`, port `8791`, env names match design spec.
- Zikron plugin tree wiring deferred to a zeek follow-up plan (called out in File map).
