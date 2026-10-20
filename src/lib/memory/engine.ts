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

import {
  getCachedEmbedDevice,
  gpuEmbedderGate,
  probeEmbedDevice,
  warmEmbedDeviceProbe,
  type EmbedDeviceStatus,
} from "./device";
import {
  getActiveEmbedderProfile,
  getEmbeddingError,
  getEmbeddingModelName,
  isEmbeddingReady,
  resetEmbeddings,
  warmEmbeddings,
} from "./embed";
import { listEmbedders, type EmbedderId } from "./embedders";
import { getDataDir, getDbPath, PRODUCT_NAME } from "./paths";
import { buildProfile, formatContextPrompt } from "./profile";
import { hybridSearch } from "./search";
import {
  readSettings,
  resolveActiveEmbedder,
  updateSettings,
  type OwnMemorySettings,
} from "./settings";
import {
  countActiveMemories,
  forgetMemory,
  forgetMemoryById,
  getMemoryById,
  hardDeleteMemory,
  listActiveMemories,
  listMemoriesPage,
  listSpaces,
  saveMemory,
  updateMemoryById,
  type MemoryPatch,
} from "./store";
import type { Memory, Profile, ScoredMemory, WhoAmI } from "./types";
import { OWNMEMORY_VERSION } from "./version";

let warmed = false;

export function ensureEngine(): void {
  if (!warmed) {
    warmed = true;
    warmEmbedDeviceProbe();
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
  const settings = readSettings();
  const resolved = resolveActiveEmbedder();
  const device = getCachedEmbedDevice();
  return {
    product: PRODUCT_NAME,
    version: OWNMEMORY_VERSION,
    mode: "local",
    dataDir: getDataDir(),
    dbPath: getDbPath(),
    embeddingModel: getEmbeddingModelName(),
    embeddingReady: isEmbeddingReady(),
    embedderId: resolved.profile.id,
    embedderLabel: `${resolved.profile.label} (${resolved.source})`,
    reembedRequired: settings.reembedRequired,
    inferMode: settings.infer.mode,
    requestedEmbedderId: resolved.requestedId,
    gpuFallbackReason: resolved.gpuFallbackReason,
    embedDevice: device,
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

export function getMemoryTool(id: string): Memory | null {
  ensureEngine();
  return getMemoryById(id);
}

export async function updateMemoryTool(
  id: string,
  patch: MemoryPatch,
): Promise<Memory | null> {
  ensureEngine();
  return updateMemoryById(id, patch);
}

export function deleteMemoryTool(
  id: string,
  hard = false,
): { ok: boolean; memory: Memory | null } {
  ensureEngine();
  if (hard) {
    const existing = getMemoryById(id);
    const ok = hardDeleteMemory(id);
    return { ok, memory: existing };
  }
  const memory = forgetMemoryById(id);
  return { ok: Boolean(memory), memory };
}

export function listMemoriesTool(options?: {
  containerTag?: string;
  limit?: number;
  offset?: number;
}) {
  ensureEngine();
  return listMemoriesPage(options);
}

export function getSettingsSnapshot() {
  ensureEngine();
  const settings = readSettings();
  const active = resolveActiveEmbedder();
  return {
    settings,
    activeEmbedder: active.profile,
    activeSource: active.source,
    envOverride: active.envOverride,
    requestedEmbedderId: active.requestedId,
    gpuFallbackReason: active.gpuFallbackReason,
    embedDevice: getCachedEmbedDevice(),
    catalog: listEmbedders(),
  };
}

export type SetEmbedderResult = {
  settings: OwnMemorySettings;
  activeEmbedder: ReturnType<typeof resolveActiveEmbedder>["profile"];
  activeSource: ReturnType<typeof resolveActiveEmbedder>["source"];
  envOverride: string | null;
  requestedEmbedderId: EmbedderId;
  gpuFallbackReason: string | null;
  embedDevice: EmbedDeviceStatus;
  catalog: ReturnType<typeof listEmbedders>;
  /** True when the requested GPU embedder was refused. */
  refused: boolean;
};

/**
 * Persist embedder choice. GPU-role models are probed for CUDA first;
 * on failure settings are left unchanged and refused=true.
 */
export async function setEmbedderId(
  embedderId: string,
): Promise<SetEmbedderResult> {
  ensureEngine();
  const known = listEmbedders().find((e) => e.id === embedderId);
  if (!known) {
    throw new Error(`Unknown embedderId: ${embedderId}`);
  }

  const device = await probeEmbedDevice();
  if (known.role === "gpu") {
    const gate = gpuEmbedderGate(known);
    if (!gate.ok) {
      const snap = getSettingsSnapshot();
      return {
        ...snap,
        embedDevice: device,
        requestedEmbedderId: known.id,
        gpuFallbackReason: gate.reason,
        refused: true,
      };
    }
  }

  updateSettings({ embedderId: embedderId as EmbedderId });
  resetEmbeddings();
  warmEmbeddings();
  return {
    ...getSettingsSnapshot(),
    embedDevice: device,
    refused: false,
  };
}

export function setInferSettings(
  infer: Partial<OwnMemorySettings["infer"]>,
): OwnMemorySettings {
  ensureEngine();
  return updateSettings({ infer });
}

export function clearReembedFlag(): OwnMemorySettings {
  ensureEngine();
  return updateSettings({ reembedRequired: false });
}

export {
  listSpaces,
  listActiveMemories,
  countActiveMemories,
  hardDeleteMemory,
  getEmbeddingError,
  getActiveEmbedderProfile,
  listEmbedders,
};
