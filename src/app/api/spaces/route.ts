/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file.
 */

import { NextResponse } from "next/server";
import { listSpaces } from "@/lib/memory/engine";
import { ensureSpace } from "@/lib/memory/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ spaces: listSpaces() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const space = ensureSpace(body.name);
  return NextResponse.json({ space });
}
