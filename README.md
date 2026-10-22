# OwnMemory

**Local-first persistent memory for AI agents.** Runs entirely on your machine — SQLite storage, on-device embeddings, hybrid search, and a Cursor-compatible MCP server. No Supermemory account. No cloud API. Your silicon, your data.

This is a replacement component, not a client shell around someone else’s service.

## What you get

| Capability | How OwnMemory does it |
| --- | --- |
| Save / forget memories | `memory` MCP tool + HTTP API |
| Semantic + keyword recall | Hybrid FTS5 + snowflake-arctic-embed-s |
| Spaces / projects | `containerTag` → local spaces |
| Profile / context injection | Preference heuristics + recent activity |
| Inspect account | `whoAmI` → local paths, model, counts |
| Browse / manage | Web console on port **47321** |

Data directory (default): `~/.ownmemory/`

- `ownmemory.db` — memories + FTS index  
- `models/` — cached embedding weights (downloaded once from Hugging Face, then offline)

## Quick start

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:47321](http://127.0.0.1:47321).

Smoke-test the engine (isolated temp DB):

```bash
npm run smoke
```

## Cursor plugin / MCP (the important part)

This repo ships as a **Cursor MCP server** (stdio plugin). Project config is already in:

```
.cursor/mcp.json
```

Open this folder in Cursor → **Settings → MCP** → enable **ownmemory** (approve project MCP if prompted). Tools `memory`, `recall`, `whoAmI`, `listSpaces` then appear in the agent tool list.

### OwnMemory-owned `~/.cursor` slices

Canonical copies live in this repo under `.cursor-home/` and are symlinked into `~/.cursor` (do not reverse the ownership):

| Repo (canonical) | Symlink |
| --- | --- |
| `.cursor-home/mcp.json` | `~/.cursor/mcp.json` |
| `.cursor-home/hooks/ownmemory-context.py` | `~/.cursor/hooks/ownmemory-context.py` |
| `.cursor-home/rules/ownmemory-over-mem0.mdc` | `~/.cursor/rules/ownmemory-over-mem0.mdc` |

After clone (or to repair links):

```bash
# edit .cursor-home/mcp.json args to this machine's absolute bin path, then:
ln -sfn "$PWD/.cursor-home/mcp.json" ~/.cursor/mcp.json
ln -sfn "$PWD/.cursor-home/hooks/ownmemory-context.py" ~/.cursor/hooks/ownmemory-context.py
ln -sfn "$PWD/.cursor-home/rules/ownmemory-over-mem0.mdc" ~/.cursor/rules/ownmemory-over-mem0.mdc
```

`.cursor/mcp.json` stays project-scoped (`${workspaceFolder}`). `~/.cursor/hooks.json` and chat-compressor files stay in the home Cursor directory.

Env overrides are optional — unset values use `~/.ownmemory` and `Snowflake/snowflake-arctic-embed-s`.

Run the server by hand (stdio; used by Cursor, not for browsers):

```bash
npm run mcp
```

Agent behavior for this workspace is also steered by `.cursor/rules/ownmemory.mdc`.

## Connectors

Optional host plugins — enable only what the machine uses:

- [Cursor](connectors/cursor) — standalone Cursor plugin (MCP + hooks + skills). `./connectors/cursor/scripts/install-local.sh`
- [OpenClaw](connectors/openclaw) — memory plugin with recall, store, forget, and turn hooks.
- [Open WebUI](connectors/openwebui) — a Workspace tool plus a filter that call this same HTTP API.

Mem0 packaging notes (local plugin cache audit): [docs/mem0-cursor-plugin-report.md](docs/mem0-cursor-plugin-report.md).

### MCP tools (Supermemory-shaped + 0.3 additive)

- **`memory`** — `{ content, action?: "save"|"forget", containerTag? }`
- **`recall`** — `{ query, includeProfile?, containerTag? }`
- **`whoAmI`** — local status
- **`listSpaces`** — list spaces
- **`get_memory`** — `{ id }`
- **`update_memory`** — `{ id, content?, metaType?, pinned?, branch?, meta? }`
- **`delete_memory`** — `{ id, hard? }`
- **`list_memories`** — `{ containerTag?, limit?, offset? }`

Resources: `ownmemory://profile`, `ownmemory://projects`  
Prompt: `context` — system-context injection text

## HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Status + embedding readiness |
| GET/POST/DELETE | `/api/memories` | List / save·forget / hard-delete |
| POST | `/api/search` | Hybrid recall |
| GET/POST | `/api/spaces` | List / create spaces |
| GET | `/api/profile` | Profile + context prompt |

## Environment

| Variable | Meaning |
| --- | --- |
| `OWNMEMORY_DATA_DIR` | Data root (default `~/.ownmemory`; leading `~` is expanded) |
| `OWNMEMORY_DB_PATH` | Override DB file path (`~` expanded) |
| `OWNMEMORY_EMBEDDING_MODEL` | HF id override (wins over GUI/`settings.json`) |
| `OWNMEMORY_OFFLINE=1` | Disallow remote model download |
| `OWNMEMORY_ALLOW_GPU_CPU=1` | Allow Arctic-L on CPU (default: CUDA required) |

Default embedder is arctic-s (~67MB). GUI / `settings.json` can select MiniLM (~23MB fallback) or arctic-l (~1.3GB ONNX, 1024-d, **CUDA required** — otherwise falls back to arctic-s). Stock `@xenova/transformers` / `onnxruntime-node` is CPU-only; a CUDA EP build plus enough free VRAM is needed for Arctic-L. First use downloads weights into `models/`. After changing the embedder, run `npm run reembed` and reload MCP. If embeddings fail, **keyword (FTS5) search still works**.

## Architecture

```
Cursor / agents ──stdio──► MCP server (src/mcp/server.ts)
                              │
Web console / HTTP ───────────┼──► engine (src/lib/memory/*)
                              │
                              ├── SQLite + FTS5
                              └── @xenova/transformers (local)
```

Nothing phones home for memory storage or search.

## What this is not (yet)

- Cloud connectors (Drive, Gmail, Notion)
- Proprietary long-horizon extraction models (bring your own Ollama later if you want distillation)
- Multi-machine sync (your problem to solve with backups / syncthing if needed)

Those are optional layers. The core loop — **remember → recall → forget on your disk** — is here.

## License

OwnMemory is released under the [MIT License](LICENSE).

Copyright (C) 2026 Rob Bloodgood.

There is no warranty. The full terms are in [LICENSE](LICENSE). Source files carry the copyright notice and `SPDX-License-Identifier: MIT`.

### Third-party material

Packages listed in `package.json` remain under their own licenses. The interface primitives in `src/components/ui/` were generated from the shadcn/ui registry and remain available under the MIT License. See [NOTICE](NOTICE).
