import {
  getEmbeddingError,
  getEmbeddingModelName,
  isEmbeddingReady,
  warmEmbeddings,
} from "./embed";
import { getDataDir, getDbPath, PRODUCT_NAME } from "./paths";
import { buildProfile, formatContextPrompt } from "./profile";
import { hybridSearch } from "./search";
import {
  countActiveMemories,
  forgetMemory,
  hardDeleteMemory,
  listActiveMemories,
  listSpaces,
  saveMemory,
} from "./store";
import type { Profile, ScoredMemory, WhoAmI } from "./types";

let warmed = false;

export function ensureEngine(): void {
  if (!warmed) {
    warmed = true;
    warmEmbeddings();
  }
}

export async function memoryTool(args: {
  content: string;
  action?: "save" | "forget";
  containerTag?: string;
}): Promise<{ ok: true; message: string; data: unknown }> {
  ensureEngine();
  const action = args.action ?? "save";

  if (action === "forget") {
    const result = await forgetMemory(args.content, args.containerTag);
    return {
      ok: true,
      message: result.note,
      data: { removed: result.removed },
    };
  }

  const saved = await saveMemory(args.content, args.containerTag);
  return {
    ok: true,
    message: `Saved memory in space "${saved.spaceName}".`,
    data: { memory: saved },
  };
}

export async function recallTool(args: {
  query: string;
  includeProfile?: boolean;
  containerTag?: string;
  limit?: number;
}): Promise<{
  profile?: Profile;
  results: ScoredMemory[];
  mode: string;
  query: string;
}> {
  ensureEngine();
  const includeProfile = args.includeProfile !== false;
  const { results, mode } = await hybridSearch(args.query, {
    containerTag: args.containerTag,
    limit: args.limit,
  });

  return {
    query: args.query,
    mode,
    results,
    ...(includeProfile
      ? { profile: buildProfile(args.containerTag) }
      : {}),
  };
}

export function whoAmI(): WhoAmI {
  ensureEngine();
  return {
    product: PRODUCT_NAME,
    mode: "local",
    dataDir: getDataDir(),
    dbPath: getDbPath(),
    embeddingModel: getEmbeddingModelName(),
    embeddingReady: isEmbeddingReady(),
    spaces: listSpaces(),
    totalMemories: countActiveMemories(),
  };
}

export function getProfile(containerTag?: string): Profile {
  ensureEngine();
  return buildProfile(containerTag);
}

export function getContextPrompt(
  containerTag?: string,
  includeRecent = true,
): string {
  ensureEngine();
  return formatContextPrompt(buildProfile(containerTag), includeRecent);
}

export {
  listSpaces,
  listActiveMemories,
  countActiveMemories,
  hardDeleteMemory,
  getEmbeddingError,
};
