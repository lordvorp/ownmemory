import Database from "better-sqlite3";
import { ensureDataDirs, getDbPath } from "./paths";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  ensureDataDirs();
  const instance = new Database(getDbPath());
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");

  instance.exec(`
    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding BLOB,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      forgotten INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_memories_space
      ON memories(space_id, forgotten, updated_at DESC);

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      memory_id UNINDEXED,
      space_id UNINDEXED,
      content,
      tokenize = 'porter unicode61'
    );
  `);

  const defaultSpace = instance
    .prepare(`SELECT id FROM spaces WHERE name = ?`)
    .get("default") as { id: string } | undefined;

  if (!defaultSpace) {
    const now = new Date().toISOString();
    instance
      .prepare(
        `INSERT INTO spaces (id, name, created_at) VALUES (?, ?, ?)`,
      )
      .run(crypto.randomUUID(), "default", now);
  }

  db = instance;
  return instance;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function float32ToBuffer(values: Float32Array): Buffer {
  return Buffer.from(values.buffer, values.byteOffset, values.byteLength);
}

export function bufferToFloat32(buf: Buffer | null): Float32Array | null {
  if (!buf || buf.length === 0) return null;
  return new Float32Array(
    buf.buffer,
    buf.byteOffset,
    buf.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
}
