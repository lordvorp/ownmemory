/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PRODUCT = "ownmemory";

/** Documented default data root before home expansion. */
export const DEFAULT_DATA_DIR = "~/.ownmemory";

/** Default on-device embedder when OWNMEMORY_EMBEDDING_MODEL is unset. */
export const DEFAULT_EMBEDDING_MODEL = "Snowflake/snowflake-arctic-embed-s";

/** Expand a leading `~/` (or bare `~`) to the user home directory. */
export function expandHome(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "~") {
    return os.homedir();
  }
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return trimmed;
}

export function getDataDir(): string {
  const fromEnv = process.env.OWNMEMORY_DATA_DIR?.trim();
  if (fromEnv) {
    return path.resolve(expandHome(fromEnv));
  }
  return path.resolve(expandHome(DEFAULT_DATA_DIR));
}

export function getDbPath(): string {
  const fromEnv = process.env.OWNMEMORY_DB_PATH?.trim();
  if (fromEnv) {
    return path.resolve(expandHome(fromEnv));
  }
  return path.join(getDataDir(), `${PRODUCT}.db`);
}

export function getCacheDir(): string {
  return path.join(getDataDir(), "models");
}

export function ensureDataDirs(): void {
  fs.mkdirSync(getDataDir(), { recursive: true });
  fs.mkdirSync(getCacheDir(), { recursive: true });
}

export const PRODUCT_NAME = "OwnMemory";

/** @deprecated Prefer resolveActiveEmbedder() / getEmbeddingModelName(). */
export const EMBEDDING_MODEL =
  process.env.OWNMEMORY_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
