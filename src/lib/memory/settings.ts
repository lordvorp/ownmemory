/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 */

import fs from "node:fs";
import path from "node:path";
import { gpuEmbedderGate } from "./device";
import {
  DEFAULT_EMBEDDER_ID,
  FALLBACK_EMBEDDER_ID,
  type EmbedderId,
  getEmbedderProfile,
  profileFromHfModel,
} from "./embedders";
import { ensureDataDirs, getDataDir } from "./paths";

/**
 * Infer / extraction pipeline — reserved for future use.
 * mode "off" = unused (current). local | openai_compatible | cloud kept for later.
 */
export type InferSettings = {
  mode: "off" | "local" | "openai_compatible" | "cloud";
  /** e.g. http://127.0.0.1:11434/v1 for Ollama */
  baseUrl: string | null;
  model: string | null;
  /** Upstream cloud endpoint placeholder (unused while mode is off) */
  cloudUrl: string | null;
};

export type OwnMemorySettings = {
  version: 1;
  /** Catalog id: minilm | arctic-s | arctic-l */
  embedderId: EmbedderId;
  /** Set when embedder changes until user re-embeds */
  reembedRequired: boolean;
  infer: InferSettings;
};

const DEFAULT_INFER: InferSettings = {
  mode: "off",
  baseUrl: null,
  model: null,
  cloudUrl: null,
};

function settingsPath(): string {
  return path.join(getDataDir(), "settings.json");
}

function defaults(): OwnMemorySettings {
  return {
    version: 1,
    embedderId: DEFAULT_EMBEDDER_ID,
    reembedRequired: false,
    infer: { ...DEFAULT_INFER },
  };
}

export function readSettings(): OwnMemorySettings {
  ensureDataDirs();
  const file = settingsPath();
  if (!fs.existsSync(file)) {
    return defaults();
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<OwnMemorySettings>;
    const embedderId = (raw.embedderId ?? DEFAULT_EMBEDDER_ID) as EmbedderId;
    return {
      version: 1,
      embedderId: getEmbedderProfile(embedderId).id,
      reembedRequired: Boolean(raw.reembedRequired),
      infer: {
        ...DEFAULT_INFER,
        ...(raw.infer ?? {}),
      },
    };
  } catch {
    return defaults();
  }
}

export function writeSettings(next: OwnMemorySettings): OwnMemorySettings {
  ensureDataDirs();
  const normalized: OwnMemorySettings = {
    version: 1,
    embedderId: getEmbedderProfile(next.embedderId).id,
    reembedRequired: Boolean(next.reembedRequired),
    infer: {
      ...DEFAULT_INFER,
      ...next.infer,
    },
  };
  fs.writeFileSync(settingsPath(), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export function updateSettings(patch: {
  embedderId?: EmbedderId;
  reembedRequired?: boolean;
  infer?: Partial<InferSettings>;
}): OwnMemorySettings {
  const current = readSettings();
  const next: OwnMemorySettings = {
    version: 1,
    embedderId: patch.embedderId ?? current.embedderId,
    reembedRequired:
      patch.reembedRequired !== undefined
        ? patch.reembedRequired
        : current.reembedRequired,
    infer: {
      ...current.infer,
      ...(patch.infer ?? {}),
    },
  };
  if (patch.embedderId && patch.embedderId !== current.embedderId) {
    next.reembedRequired = true;
  }
  return writeSettings(next);
}

export type ResolvedEmbedder = {
  profile: ReturnType<typeof getEmbedderProfile>;
  source: "env" | "settings" | "fallback";
  envOverride: string | null;
  /** Set when a GPU-role choice was refused and Arctic-S is used. */
  gpuFallbackReason: string | null;
  requestedId: EmbedderId;
};

function applyGpuGate(
  profile: ReturnType<typeof getEmbedderProfile>,
  source: "env" | "settings",
  envOverride: string | null,
): ResolvedEmbedder {
  const gate = gpuEmbedderGate(profile);
  if (gate.ok) {
    return {
      profile,
      source,
      envOverride,
      gpuFallbackReason: null,
      requestedId: profile.id,
    };
  }
  return {
    profile: getEmbedderProfile(DEFAULT_EMBEDDER_ID),
    source: "fallback",
    envOverride,
    gpuFallbackReason: gate.reason,
    requestedId: profile.id,
  };
}

/**
 * Active HF model: env OWNMEMORY_EMBEDDING_MODEL wins, else settings catalog.
 * GPU-role models (arctic-l) require CUDA; otherwise fall back to Arctic-S.
 */
export function resolveActiveEmbedder(): ResolvedEmbedder {
  const envModel = process.env.OWNMEMORY_EMBEDDING_MODEL?.trim() || null;
  if (envModel) {
    const known = profileFromHfModel(envModel);
    if (known) {
      return applyGpuGate(known, "env", envModel);
    }
    // Unknown HF id from env — synthesize a mean-pool profile
    return {
      profile: {
        id: FALLBACK_EMBEDDER_ID,
        hfModel: envModel,
        label: envModel,
        description: "Custom model from OWNMEMORY_EMBEDDING_MODEL",
        dims: 384,
        approxMB: 0,
        pooling: "cls",
        queryPrefix: null,
        quantized: true,
        role: "default",
      },
      source: "env",
      envOverride: envModel,
      gpuFallbackReason: null,
      requestedId: FALLBACK_EMBEDDER_ID,
    };
  }
  const settings = readSettings();
  return applyGpuGate(getEmbedderProfile(settings.embedderId), "settings", null);
}
