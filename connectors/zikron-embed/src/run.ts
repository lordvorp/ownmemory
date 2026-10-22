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
} from "../../../src/lib/memory/embed";
import { createEmbedServer } from "./server";

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
    engine: profile.id,
    model: profile.hfModel,
    dims: profile.dims,
    pooling: profile.pooling,
  },
  isReady: () => isEmbeddingReady(),
});

warmEmbeddings();

server.listen(port, host, () => {
  console.log(
    `ownmemory-embed listening on http://${host}:${port} engine=${profile.id} model=${profile.hfModel} dims=${profile.dims}`,
  );
});
