import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { textResult } from "openclaw/plugin-sdk/tool-results";

const ROOT = dirname(fileURLToPath(import.meta.url));
const TYPEBOX_VERSION = "1.3.27";

function loadTypeBox() {
  const localRequire = createRequire(join(ROOT, "package.json"));
  try {
    return localRequire("typebox");
  } catch (err) {
    if (err?.code !== "MODULE_NOT_FOUND") {
      throw err;
    }
  }

  const install = spawnSync(
    "npm",
    [
      "install",
      "--prefix",
      ROOT,
      "--omit=dev",
      "--no-fund",
      "--no-audit",
      "--ignore-scripts",
    ],
    { stdio: "inherit" },
  );
  if (install.error) {
    throw new Error(`Could not run npm to install typebox@${TYPEBOX_VERSION}: ${install.error.message}`);
  }
  if (install.status !== 0) {
    throw new Error(`npm install of typebox@${TYPEBOX_VERSION} exited ${install.status}`);
  }
  return localRequire("typebox");
}

const { Type } = loadTypeBox();

const DEFAULT_BASE_URL = "http://127.0.0.1:47321";
const DEFAULT_SPACE = "openclaw";
const MIN_CHARS = 40;
const MAX_CHARS = 1200;
const TIMEOUT_MS = 4000;

function settings(api) {
  const cfg = api?.pluginConfig ?? {};
  const baseUrl = String(cfg.baseUrl || process.env.OWNMEMORY_BASE_URL || DEFAULT_BASE_URL)
    .trim()
    .replace(/\/$/, "");
  return {
    baseUrl,
    space: String(cfg.space || DEFAULT_SPACE).trim() || DEFAULT_SPACE,
    autoRecall: cfg.autoRecall !== false,
    autoCapture: cfg.autoCapture !== false,
  };
}

async function ownFetch(baseUrl, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `OwnMemory ${response.status}`);
  }
  return body;
}

function skipText(text) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (value.length < MIN_CHARS || value.length > 20000) {
    return true;
  }
  const lower = value.toLowerCase();
  return (
    lower.includes("mem0 — setup required") ||
    lower.includes("mem0 - setup required") ||
    lower.includes("begin private key") ||
    lower.includes("api_key=") ||
    lower.includes("password=")
  );
}

function clip(text) {
  const value = String(text).replace(/\s+/g, " ").trim();
  return value.length > MAX_CHARS ? `${value.slice(0, MAX_CHARS).trimEnd()}…` : value;
}

function userTexts(messages) {
  const texts = [];
  for (const message of messages ?? []) {
    if (!message || message.role !== "user") {
      continue;
    }
    if (typeof message.content === "string") {
      texts.push(message.content);
      continue;
    }
    if (!Array.isArray(message.content)) {
      continue;
    }
    for (const block of message.content) {
      if (block?.type === "text" && typeof block.text === "string") {
        texts.push(block.text);
      }
    }
  }
  return texts;
}

async function searchMemories(baseUrl, query, limit = 5) {
  const body = await ownFetch(baseUrl, "/api/search", {
    method: "POST",
    body: JSON.stringify({ query, includeProfile: false, limit }),
  });
  return Array.isArray(body.results) ? body.results : [];
}

async function saveMemory(baseUrl, space, content) {
  const recent = await ownFetch(
    baseUrl,
    `/api/memories?space=${encodeURIComponent(space)}&limit=8`,
  );
  const existing = (recent.memories ?? []).some((memory) => memory.content === content);
  if (existing) {
    return { saved: false, reason: "duplicate" };
  }
  const result = await ownFetch(baseUrl, "/api/memories", {
    method: "POST",
    body: JSON.stringify({ content, action: "save", containerTag: space }),
  });
  return { saved: true, result };
}

function formatRecall(results) {
  const lines = results.slice(0, 5).map((memory) => {
    const where = memory.spaceName ? `${memory.spaceName}: ` : "";
    return `- ${where}${clip(memory.content).slice(0, 300)}`;
  });
  if (lines.length === 0) {
    return "";
  }
  return `OwnMemory context:\n${lines.join("\n")}`;
}

const plugin = definePluginEntry({
  id: "openclaw-ownmemory",
  name: "Memory (OwnMemory)",
  description: "Local OwnMemory backend for recall and capture.",
  kind: "memory",
  register(api) {
    const current = () => settings(api);

    api.registerTool(
      () => ({
        name: "memory_recall",
        label: "Memory Recall",
        description: "Search local OwnMemory notes across every space.",
        parameters: Type.Object({
          query: Type.String({ description: "What to look for" }),
          limit: Type.Optional(Type.Number({ description: "Maximum results, default 5" })),
        }),
        async execute(_toolCallId, params) {
          const { baseUrl } = current();
          const query = String(params?.query ?? "").trim();
          if (!query) {
            return textResult("Provide a query.", { error: "missing_param" });
          }
          const results = await searchMemories(baseUrl, query, Number(params?.limit) || 5);
          if (results.length === 0) {
            return textResult("No matching OwnMemory notes.", { results: [] });
          }
          const list = results
            .map((memory) => `${memory.id} [${memory.spaceName}] ${clip(memory.content)}`)
            .join("\n");
          return textResult(list, { results });
        },
      }),
      { name: "memory_recall" },
    );

    api.registerTool(
      () => ({
        name: "memory_store",
        label: "Memory Store",
        description: "Save a durable note in local OwnMemory.",
        parameters: Type.Object({
          content: Type.String({ description: "The fact to remember" }),
          space: Type.Optional(Type.String({ description: "Space name, default openclaw" })),
        }),
        async execute(_toolCallId, params) {
          const cfg = current();
          const content = clip(params?.content ?? "");
          if (skipText(content)) {
            return textResult("Skipped. Note is too short or looks like a secret.", {
              action: "skipped",
            });
          }
          const space = String(params?.space || cfg.space);
          const saved = await saveMemory(cfg.baseUrl, space, content);
          return textResult(
            saved.saved ? `Stored in ${space}.` : `Already stored in ${space}.`,
            saved,
          );
        },
      }),
      { name: "memory_store" },
    );

    api.registerTool(
      () => ({
        name: "memory_forget",
        label: "Memory Forget",
        description: "Forget an OwnMemory note by id.",
        parameters: Type.Object({
          memoryId: Type.String({ description: "Memory id from memory_recall" }),
        }),
        async execute(_toolCallId, params) {
          const { baseUrl } = current();
          const memoryId = String(params?.memoryId ?? "").trim();
          if (!memoryId) {
            return textResult("Provide memoryId.", { error: "missing_param" });
          }
          const result = await ownFetch(
            baseUrl,
            `/api/memories?id=${encodeURIComponent(memoryId)}`,
            { method: "DELETE" },
          );
          return textResult(result.ok ? `Forgot ${memoryId}.` : `No memory ${memoryId}.`, result);
        },
      }),
      { name: "memory_forget" },
    );

    api.on("before_prompt_build", async (event) => {
      const cfg = current();
      if (!cfg.autoRecall || skipText(event?.prompt)) {
        return;
      }
      try {
        const results = await searchMemories(cfg.baseUrl, clip(event.prompt), 5);
        const context = formatRecall(results);
        return context ? { prependContext: context } : undefined;
      } catch (err) {
        api.logger.warn?.(`openclaw-ownmemory: recall failed: ${err}`);
      }
    });

    api.on("agent_end", async (event, ctx) => {
      const cfg = current();
      if (!cfg.autoCapture || !event?.success || ctx?.sessionKey?.includes("incognito")) {
        return;
      }
      const text = userTexts(event.messages).map(clip).findLast((item) => !skipText(item));
      if (!text) {
        return;
      }
      try {
        await saveMemory(cfg.baseUrl, cfg.space, text);
      } catch (err) {
        api.logger.warn?.(`openclaw-ownmemory: capture failed: ${err}`);
      }
    });
  },
});

export default plugin;
