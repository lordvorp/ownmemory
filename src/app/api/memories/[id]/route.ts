/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: GPL-2.0-only
 */

import { NextResponse } from "next/server";
import {
  deleteMemoryTool,
  getMemoryTool,
  updateMemoryTool,
} from "@/lib/memory/engine";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const memory = getMemoryTool(id);
  if (!memory) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ memory });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    content?: string;
    metaType?: string | null;
    pinned?: boolean;
    branch?: string | null;
    meta?: Record<string, unknown> | null;
  };
  try {
    const memory = await updateMemoryTool(id, body);
    if (!memory) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ memory });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const hard = searchParams.get("hard") === "1";
  const result = deleteMemoryTool(id, hard);
  if (!result.ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
