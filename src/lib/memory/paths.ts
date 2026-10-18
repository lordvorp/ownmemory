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
