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
