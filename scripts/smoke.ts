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

/**
 * End-to-end smoke test against the local OwnMemory engine.
 * Uses an isolated temp database — never touches your real ~/.ownmemory.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ownmemory-smoke-"));
process.env.OWNMEMORY_DATA_DIR = tmp;
process.env.OWNMEMORY_DB_PATH = path.join(tmp, "smoke.db");

async function main() {
  const { memoryTool, recallTool, whoAmI, getProfile } = await import(
    "../src/lib/memory/engine"
  );

  console.log("data dir:", tmp);

  const save = await memoryTool({
    content: "Rob prefers conventional commits and local-first tooling.",
    containerTag: "smoke",
  });
  console.log("save:", save.message);

  await memoryTool({
    content: "OwnMemory stores vectors in SQLite on local silicon.",
    containerTag: "smoke",
  });

  const recall = await recallTool({
    query: "What does Rob prefer for git?",
    containerTag: "smoke",
    includeProfile: true,
  });
  console.log("recall mode:", recall.mode);
  console.log(
    "top hit:",
    recall.results[0]?.content?.slice(0, 80) ?? "(none)",
  );

  const profile = getProfile("smoke");
  console.log("profile memories:", profile.memoryCount);

  const me = whoAmI();
  console.log("whoAmI:", me.product, me.mode, "spaces=", me.spaces.length);

  const forget = await memoryTool({
    content: "Rob prefers conventional commits",
    action: "forget",
    containerTag: "smoke",
  });
  console.log("forget:", forget.message);

  if (!recall.results.length) {
    throw new Error("Expected at least one recall hit");
  }

  console.log("SMOKE OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
