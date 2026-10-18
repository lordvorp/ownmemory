"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type Memory = {
  id: string;
  spaceId: string;
  spaceName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type Space = { id: string; name: string; createdAt: string };

type Health = {
  product: string;
  mode: string;
  dataDir: string;
  dbPath: string;
  embeddingModel: string;
  embeddingReady: boolean;
  totalMemories: number;
  embeddingError: string | null;
  mcp?: {
    command: string;
    args: string[];
    env: Record<string, string>;
  };
};

type SearchHit = Memory & {
  score: number;
  match: string;
};

export function MemoryConsole() {
  const [health, setHealth] = useState<Health | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [space, setSpace] = useState("default");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchMode, setSearchMode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    setError(null);
    const [healthRes, spacesRes, memRes] = await Promise.all([
      fetch("/api/health"),
      fetch("/api/spaces"),
      fetch(`/api/memories?space=${encodeURIComponent(space)}&limit=100`),
    ]);

    if (!healthRes.ok || !spacesRes.ok || !memRes.ok) {
      throw new Error("Failed to load OwnMemory state");
    }

    const healthJson = (await healthRes.json()) as Health;
    const spacesJson = (await spacesRes.json()) as { spaces: Space[] };
    const memJson = (await memRes.json()) as { memories: Memory[] };

    setHealth(healthJson);
    setSpaces(spacesJson.spaces);
    setMemories(memJson.memories);
  }, [space]);

  useEffect(() => {
    startTransition(() => {
      void refresh().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    });
  }, [refresh]);

  async function onSave() {
    setError(null);
    setStatus(null);
    const res = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        action: "save",
        containerTag: space,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Save failed");
      return;
    }
    setContent("");
    setStatus(json.message ?? "Saved.");
    await refresh();
  }

  async function onForget() {
    setError(null);
    setStatus(null);
    const res = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        action: "forget",
        containerTag: space,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Forget failed");
      return;
    }
    setStatus(json.message ?? "Forgot.");
    await refresh();
  }

  async function onSearch() {
    setError(null);
    setStatus(null);
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        containerTag: space,
        includeProfile: false,
        limit: 10,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Search failed");
      return;
    }
    setHits(json.results ?? []);
    setSearchMode(json.mode ?? "");
  }

  async function onDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/memories?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError("Delete failed");
      return;
    }
    await refresh();
  }

  async function onCreateSpace(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      setError("Could not create space");
      return;
    }
    setSpace(trimmed);
    await refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 md:px-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="font-heading text-sm tracking-[0.22em] text-teal-800/80 uppercase">
            Local silicon · no cloud account
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-stone-900 md:text-5xl">
            OwnMemory
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-stone-600">
            Persistent agent memory that lives on your machine. Hybrid
            keyword + on-device semantic search. Cursor MCP included.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-md px-3 py-1">
            {health?.mode ?? "local"}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-md border-teal-700/30 px-3 py-1 text-teal-900"
          >
            {health?.embeddingReady ? "embeddings ready" : "embeddings loading"}
          </Badge>
          <Badge variant="outline" className="rounded-md px-3 py-1">
            {health?.totalMemories ?? 0} memories
          </Badge>
        </div>
      </header>

      {(error || status || health?.embeddingError) && (
        <div className="space-y-2 text-sm">
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">
              {error}
            </p>
          )}
          {status && (
            <p className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-teal-900">
              {status}
            </p>
          )}
          {health?.embeddingError && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              Embedding model issue (keyword search still works):{" "}
              {health.embeddingError}
            </p>
          )}
        </div>
      )}

      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[10rem] flex-1 space-y-2">
              <Label htmlFor="space">Space</Label>
              <select
                id="space"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={space}
                onChange={(e) => setSpace(e.target.value)}
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const name = window.prompt("New space name");
                if (name) void onCreateSpace(name);
              }}
            >
              New space
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => void refresh()}
            >
              Refresh
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Remember</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Rob prefers conventional commits and local-first tooling."
              className="min-h-28"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void onSave()} disabled={!content.trim()}>
                Save memory
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void onForget()}
                disabled={!content.trim()}
              >
                Forget match
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="query">Recall</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What does Rob prefer for git commits?"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onSearch();
                }}
              />
              <Button type="button" onClick={() => void onSearch()} disabled={!query.trim()}>
                Search
              </Button>
            </div>
            {searchMode && (
              <p className="text-xs text-stone-500">Search mode: {searchMode}</p>
            )}
            <ul className="space-y-3 pt-2">
              {hits.map((hit) => (
                <li
                  key={hit.id}
                  className="border-b border-stone-200/80 pb-3 last:border-0"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span>{hit.match}</span>
                    <span>·</span>
                    <span>{(hit.score * 100).toFixed(0)}% score</span>
                    <span>·</span>
                    <span>{hit.spaceName}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-stone-800">
                    {hit.content}
                  </p>
                </li>
              ))}
              {!hits.length && query && (
                <li className="text-sm text-stone-500">No matches yet.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-heading text-xl font-medium text-stone-900">
              Stored in `{space}`
            </h2>
            <p className="text-sm text-stone-500">
              {memories.length} active · data at{" "}
              <code className="text-xs">{health?.dbPath ?? "…"}</code>
            </p>
          </div>
          <ul className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
            {memories.map((m) => (
              <li
                key={m.id}
                className="group border-b border-stone-200/80 pb-3 last:border-0"
              >
                <p className="text-sm leading-relaxed text-stone-800">
                  {m.content}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-stone-500">
                  <span>{new Date(m.updatedAt).toLocaleString()}</span>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="opacity-70 group-hover:opacity-100"
                    onClick={() => void onDelete(m.id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
            {!memories.length && (
              <li className="text-sm text-stone-500">
                Empty space. Save a fact to begin.
              </li>
            )}
          </ul>

          <div className="rounded-md border border-stone-200 bg-white/50 p-4 text-xs leading-relaxed text-stone-600">
            <p className="mb-2 font-medium text-stone-800">Model</p>
            <p>{health?.embeddingModel ?? "…"}</p>
            <p className="mt-2 font-medium text-stone-800">Cursor MCP</p>
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] text-stone-700">
              {JSON.stringify(
                {
                  mcpServers: {
                    ownmemory: health?.mcp ?? {
                      command: "npx",
                      args: ["tsx", "src/mcp/server.ts"],
                    },
                  },
                },
                null,
                2,
              )}
            </pre>
            <p className="mt-2">
              Paste into <code>~/.cursor/mcp.json</code>. Restart Cursor MCP
              after saving.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
