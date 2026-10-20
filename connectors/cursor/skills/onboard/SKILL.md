---
name: onboard
description: >-
  First-time OwnMemory setup on a previously untouched machine or workspace.
  Detects connectors, installs the Cursor plugin locally, verifies MCP, and
  records defaults. Use when OwnMemory is missing, MCP is disconnected, or
  after a fresh clone.
---

# OwnMemory onboard (cold system)

Execute steps **in order**. Fail open and report; do not invent cloud accounts.

## Step 0 — Locate the repo

Prefer workspace root containing `bin/ownmemory-mcp.mjs`. If missing, ask for the OwnMemory clone path (default `~/work/ownmemory`).

## Step 1 — Dependencies

```bash
cd "$OWNMEMORY_ROOT" && npm install
```

## Step 2 — Install Cursor plugin (local)

```bash
"$OWNMEMORY_ROOT/connectors/cursor/scripts/install-local.sh"
```

This symlinks the plugin into `~/.cursor/plugins/local/ownmemory` and refreshes OwnMemory-owned `~/.cursor` slices under `.cursor-home/`.

## Step 3 — Optional connectors (if present / requested)

Treat each connector as an **optional plugin** at install time — enable only what the host already uses:

| Connector | When to install |
| --- | --- |
| `connectors/cursor` | Always for Cursor agents (this skill) |
| `connectors/openclaw` | OpenClaw host present (`openclaw plugins install …`) |
| `connectors/openwebui` | Open WebUI workspace tools/filters desired |

Do not install OpenClaw/Open WebUI pieces on a Cursor-only machine unless the user asks.

## Step 4 — Verify MCP

Call `whoAmI`. Expect `product: OwnMemory`, a `version`, `embeddingModel` (default arctic-embed-s), and a `dataDir` under `~/.ownmemory`.

If MCP is disconnected: reload Cursor window (Linux: Ctrl+R) or toggle the **ownmemory** plugin/MCP in Settings.

## Step 5 — Smoke save/recall

```
memory { action: "save", content: "OwnMemory onboard smoke test", containerTag: "ownmemory" }
recall { query: "onboard smoke test", containerTag: "ownmemory" }
```

## Step 6 — Summarize

Report: plugin path, MCP ready?, embedder, dataDir, which connectors were installed.
