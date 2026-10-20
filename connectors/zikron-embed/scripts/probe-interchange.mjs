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
  let dot = 0,
    na = 0,
    nb = 0;
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
    void (async () => {
      const v = await embedText(${JSON.stringify(text)}, ${JSON.stringify(role)});
      process.stdout.write(JSON.stringify(Array.from(v)));
    })();
  `;
  const child = spawn("npx", ["tsx", "-e", code], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      OWNMEMORY_EMBEDDING_MODEL: "Snowflake/snowflake-arctic-embed-s",
    },
  });
  let out = "",
    err = "";
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
