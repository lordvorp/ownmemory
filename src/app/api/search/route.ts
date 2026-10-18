import { NextResponse } from "next/server";
import { recallTool } from "@/lib/memory/engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    query?: string;
    containerTag?: string;
    includeProfile?: boolean;
    limit?: number;
  };

  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const result = await recallTool({
      query: body.query,
      containerTag: body.containerTag,
      includeProfile: body.includeProfile,
      limit: body.limit,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
