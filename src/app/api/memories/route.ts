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

import { NextResponse } from "next/server";
import {
  countActiveMemories,
  hardDeleteMemory,
  listActiveMemories,
  memoryTool,
} from "@/lib/memory/engine";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const space = searchParams.get("space") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");

  const memories = listActiveMemories(space, limit, offset);
  return NextResponse.json({
    memories,
    total: countActiveMemories(space),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    content?: string;
    action?: "save" | "forget";
    containerTag?: string;
  };

  if (!body.content?.trim()) {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 },
    );
  }

  try {
    const result = await memoryTool({
      content: body.content,
      action: body.action,
      containerTag: body.containerTag,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const ok = hardDeleteMemory(id);
  return NextResponse.json({ ok });
}
