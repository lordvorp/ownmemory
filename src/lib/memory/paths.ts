/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; version 2.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PRODUCT = "ownmemory";

export function getDataDir(): string {
  const fromEnv = process.env.OWNMEMORY_DATA_DIR?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.join(os.homedir(), `.${PRODUCT}`);
}

export function getDbPath(): string {
  const fromEnv = process.env.OWNMEMORY_DB_PATH?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
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
export const EMBEDDING_MODEL =
  process.env.OWNMEMORY_EMBEDDING_MODEL?.trim() ||
  "Xenova/all-MiniLM-L6-v2";
