/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: GPL-2.0-only
 */

import { execFileSync } from "node:child_process";
import type { EmbedderProfile } from "./embedders";

export type EmbedDeviceStatus = {
  /** True only when onnxruntime-node exposes a working CUDA EP. */
  cudaAvailable: boolean;
  reason: string;
  gpuName: string | null;
  vramTotalMiB: number | null;
  vramFreeMiB: number | null;
  /** Extra headroom beyond model approxMB before we refuse GPU load. */
  vramHeadroomMiB: number;
};

const VRAM_HEADROOM_MIB = 256;

let cached: EmbedDeviceStatus | null = null;
let probePromise: Promise<EmbedDeviceStatus> | null = null;

function readNvidiaSmi(): Pick<
  EmbedDeviceStatus,
  "gpuName" | "vramTotalMiB" | "vramFreeMiB"
> {
  try {
    const out = execFileSync(
      "nvidia-smi",
      [
        "--query-gpu=name,memory.total,memory.free",
        "--format=csv,noheader,nounits",
      ],
      { encoding: "utf8", timeout: 3000 },
    ).trim();
    const line = out.split("\n")[0]?.trim();
    if (!line) {
      return { gpuName: null, vramTotalMiB: null, vramFreeMiB: null };
    }
    const parts = line.split(",").map((p) => p.trim());
    const name = parts[0] || null;
    const total = Number(parts[1]);
    const free = Number(parts[2]);
    return {
      gpuName: name,
      vramTotalMiB: Number.isFinite(total) ? total : null,
      vramFreeMiB: Number.isFinite(free) ? free : null,
    };
  } catch {
    return { gpuName: null, vramTotalMiB: null, vramFreeMiB: null };
  }
}

async function probeCudaEp(): Promise<{ ok: boolean; detail: string }> {
  try {
    const ort = await import("onnxruntime-node");
    // Intentionally invalid path: we only care whether the CUDA EP exists.
    await ort.InferenceSession.create("__ownmemory_cuda_probe__.onnx", {
      executionProviders: ["cuda"],
    });
    return { ok: true, detail: "CUDA execution provider accepted a session" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const first = msg.split("\n")[0] ?? msg;
    // Stock onnxruntime-node is CPU-only; missing EP fails before file I/O.
    if (/no available backend/i.test(msg)) {
      return {
        ok: false,
        detail:
          "onnxruntime-node has no CUDA execution provider (CPU-only build)",
      };
    }
    // EP was selected but the probe path failed → CUDA backend is present.
    return { ok: true, detail: `CUDA EP present (${first})` };
  }
}

export async function probeEmbedDevice(
  force = false,
): Promise<EmbedDeviceStatus> {
  if (cached && !force) return cached;
  if (probePromise && !force) return probePromise;

  probePromise = (async () => {
    const smi = readNvidiaSmi();
    const cuda = await probeCudaEp();
    const status: EmbedDeviceStatus = {
      cudaAvailable: cuda.ok,
      reason: cuda.ok
        ? `CUDA EP available${smi.gpuName ? ` on ${smi.gpuName}` : ""}`
        : cuda.detail,
      gpuName: smi.gpuName,
      vramTotalMiB: smi.vramTotalMiB,
      vramFreeMiB: smi.vramFreeMiB,
      vramHeadroomMiB: VRAM_HEADROOM_MIB,
    };
    cached = status;
    return status;
  })();

  try {
    return await probePromise;
  } finally {
    probePromise = null;
  }
}

export function getCachedEmbedDevice(): EmbedDeviceStatus | null {
  return cached;
}

/** Kick a background probe so resolveActiveEmbedder can stay sync. */
export function warmEmbedDeviceProbe(): void {
  void probeEmbedDevice().catch(() => {
    // surfaced via getCachedEmbedDevice / whoAmI after settle
  });
}

/**
 * GPU-role embedders (arctic-l) require a working CUDA EP and enough free VRAM.
 * Until the probe finishes, refuse GPU models (fail closed → fall back).
 */
export function gpuEmbedderGate(profile: EmbedderProfile): {
  ok: boolean;
  reason: string;
} {
  if (profile.role !== "gpu") {
    return { ok: true, reason: "not a GPU-role embedder" };
  }

  const forceCpu = process.env.OWNMEMORY_ALLOW_GPU_CPU === "1";
  if (forceCpu) {
    return {
      ok: true,
      reason: "OWNMEMORY_ALLOW_GPU_CPU=1 (CPU allowed for GPU-role model)",
    };
  }

  const status = cached;
  if (!status) {
    return {
      ok: false,
      reason: "CUDA probe not finished yet; refusing GPU embedder until checked",
    };
  }
  if (!status.cudaAvailable) {
    return { ok: false, reason: status.reason };
  }

  const need = profile.approxMB + status.vramHeadroomMiB;
  if (
    status.vramFreeMiB !== null &&
    status.vramFreeMiB < need
  ) {
    return {
      ok: false,
      reason: `free VRAM ${status.vramFreeMiB}MiB < ~${need}MiB needed for ${profile.id} (${profile.approxMB}MB + ${status.vramHeadroomMiB}MiB headroom)${
        status.gpuName ? ` on ${status.gpuName}` : ""
      }`,
    };
  }

  return { ok: true, reason: status.reason };
}
