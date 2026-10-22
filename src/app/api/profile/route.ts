/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file.
 */

import { NextResponse } from "next/server";
import { getContextPrompt, getProfile } from "@/lib/memory/engine";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const space = searchParams.get("space") ?? "default";
  const profile = getProfile(space);
  return NextResponse.json({
    profile,
    context: getContextPrompt(space),
  });
}
