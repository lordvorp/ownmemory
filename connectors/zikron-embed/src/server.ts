/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 */

import http from "node:http";

export type EmbedRole = "document" | "query";
export type EmbedFn = (text: string, role: EmbedRole) => Promise<Float32Array>;
/** `engine` is the catalog id (e.g. arctic-s). Store + lookup must share it. */
export type HealthInfo = {
  engine: string;
  model: string;
  dims: number;
  pooling: string;
};

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
          engine: opts.health.engine,
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
          engine: opts.health.engine,
          model: opts.health.model,
          dims: opts.health.dims,
        });
        return;
      }
      send(res, 404, { error: "not found" });
    } catch (err) {
      if (err instanceof SyntaxError) {
        send(res, 400, { error: "invalid JSON" });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      send(res, 500, { error: msg });
    }
  });
}
