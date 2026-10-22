/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 */

import { NextResponse } from "next/server";
import {
  clearReembedFlag,
  getSettingsSnapshot,
  setEmbedderId,
  setInferSettings,
} from "@/lib/memory/engine";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getSettingsSnapshot());
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    embedderId?: string;
    clearReembedRequired?: boolean;
    infer?: {
      mode?: "off" | "local" | "openai_compatible" | "cloud";
      baseUrl?: string | null;
      model?: string | null;
      cloudUrl?: string | null;
    };
  };

  try {
    if (body.embedderId) {
      const result = await setEmbedderId(body.embedderId);
      if (body.infer) {
        setInferSettings(body.infer);
      }
      if (body.clearReembedRequired) {
        clearReembedFlag();
      }
      return NextResponse.json({
        ...getSettingsSnapshot(),
        refused: result.refused,
        gpuFallbackReason: result.gpuFallbackReason,
        embedDevice: result.embedDevice,
        requestedEmbedderId: result.requestedEmbedderId,
      });
    }
    if (body.infer) {
      setInferSettings(body.infer);
    }
    if (body.clearReembedRequired) {
      clearReembedFlag();
    }
    return NextResponse.json(getSettingsSnapshot());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
