# OwnMemory

**Local-first persistent memory for AI agents.** Runs entirely on your machine — SQLite storage, on-device embeddings, hybrid search, and a Cursor-compatible MCP server. No Supermemory account. No cloud API. Your silicon, your data.

This is a replacement component, not a client shell around someone else’s service.

## What you get

| Capability | How OwnMemory does it |
| --- | --- |
| Save / forget memories | `memory` MCP tool + HTTP API |
| Semantic + keyword recall | Hybrid FTS5 + MiniLM embeddings |
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

Global install (any project on this machine):

```bash
# after cloning + npm install
cp .cursor/mcp.json ~/.cursor/mcp.json   # or merge the ownmemory block
# edit args to the absolute path of bin/ownmemory-mcp.mjs if needed
```

Manual shape:

```json
{
  "mcpServers": {
    "ownmemory": {
      "type": "stdio",
      "command": "node",
      "args": ["/ABS/PATH/TO/this-repo/bin/ownmemory-mcp.mjs"],
      "env": {
        "OWNMEMORY_DATA_DIR": "${userHome}/.ownmemory"
      }
    }
  }
}
```

Run the server by hand (stdio; used by Cursor, not for browsers):

```bash
npm run mcp
```

Agent behavior for this workspace is also steered by `.cursor/rules/ownmemory.mdc`.

## Connectors

- [OpenClaw](connectors/openclaw) — memory plugin with recall, store, forget, and turn hooks.
- [Open WebUI](connectors/openwebui) — a Workspace tool plus a filter that call this same HTTP API.

### MCP tools (Supermemory-shaped)

- **`memory`** — `{ content, action?: "save"|"forget", containerTag? }`
- **`recall`** — `{ query, includeProfile?, containerTag? }`
- **`whoAmI`** — local status
- **`listSpaces`** — list spaces

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
| `OWNMEMORY_DATA_DIR` | Data root (default `~/.ownmemory`) |
| `OWNMEMORY_DB_PATH` | Override DB file path |
| `OWNMEMORY_EMBEDDING_MODEL` | Default `Xenova/all-MiniLM-L6-v2` |
| `OWNMEMORY_OFFLINE=1` | Disallow remote model download |

First embedding run downloads the MiniLM weights (~23MB) into `models/`. After that, recall works offline. If embeddings fail, **keyword (FTS5) search still works**.

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

OwnMemory is free software. You can redistribute it and/or modify it under the terms of the GNU General Public License, version 2, as published by the Free Software Foundation. The license is **GPL-2.0-only**: version 2 applies, and later versions of the GNU GPL are not granted by this notice.

OwnMemory is distributed in the hope that it will be useful, but without any warranty, without even the implied warranty of merchantability or fitness for a particular purpose. The full terms are in [LICENSE](LICENSE).

Copyright (C) 2026 Rob Bloodgood.

Each original source file carries the same copyright notice and the standard GPL version 2 grant. That notice is the boilerplate for this program. It is not a substitute for the license text.

### Third-party material

Packages listed in `package.json` remain under their own licenses. The interface primitives in `src/components/ui/` were generated from the shadcn/ui registry and remain available under the MIT License. Including those files in this tree does not relicense them. See [NOTICE](NOTICE).
