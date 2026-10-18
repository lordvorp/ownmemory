#!/usr/bin/env node

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

/**
 * OwnMemory MCP server — stdio transport for Cursor / Claude Desktop / etc.
 * Runs entirely on local silicon. No cloud account.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  ensureEngine,
  getContextPrompt,
  getProfile,
  listSpaces,
  memoryTool,
  recallTool,
  whoAmI,
} from "../lib/memory/engine";

ensureEngine();

const server = new McpServer({
  name: "ownmemory",
  version: "0.1.0",
});

server.registerTool(
  "memory",
  {
    title: "Save or forget a memory",
    description:
      "Save durable facts/preferences/decisions, or forget outdated information. Runs on the local OwnMemory engine.",
    inputSchema: {
      content: z.string().describe("The memory content to save or forget"),
      action: z
        .enum(["save", "forget"])
        .optional()
        .describe('Default "save". Use "forget" to remove matching memories.'),
      containerTag: z
        .string()
        .optional()
        .describe('Space / project tag. Defaults to "default".'),
    },
  },
  async ({ content, action, containerTag }) => {
    const result = await memoryTool({ content, action, containerTag });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "recall",
  {
    title: "Recall memories",
    description:
      "Hybrid semantic + keyword search over local memories, optionally including the user profile.",
    inputSchema: {
      query: z.string().describe("Natural-language search query"),
      includeProfile: z
        .boolean()
        .optional()
        .describe("Include profile summary. Default true."),
      containerTag: z
        .string()
        .optional()
        .describe("Limit search to a space / project tag."),
    },
  },
  async ({ query, includeProfile, containerTag }) => {
    const result = await recallTool({ query, includeProfile, containerTag });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "whoAmI",
  {
    title: "Inspect local OwnMemory",
    description:
      "Show local mode status, data paths, embedding model, spaces, and memory counts.",
    inputSchema: {},
  },
  async () => {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(whoAmI(), null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "listSpaces",
  {
    title: "List memory spaces",
    description: "List all local memory spaces (container tags / projects).",
    inputSchema: {},
  },
  async () => {
    const spaces = listSpaces();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ count: spaces.length, spaces }, null, 2),
        },
      ],
    };
  },
);

server.registerResource(
  "profile",
  "ownmemory://profile",
  {
    title: "User profile",
    description: "Stable preferences and recent activity from the default space",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(getProfile("default"), null, 2),
      },
    ],
  }),
);

server.registerResource(
  "projects",
  "ownmemory://projects",
  {
    title: "Memory spaces",
    description: "Available local memory spaces",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({ spaces: listSpaces() }, null, 2),
      },
    ],
  }),
);

server.registerPrompt(
  "context",
  {
    title: "Inject OwnMemory context",
    description:
      "Pre-formatted system context with stable preferences and recent activity.",
    argsSchema: {
      containerTag: z
        .string()
        .optional()
        .describe('Space to load. Defaults to "default".'),
      includeRecent: z
        .string()
        .optional()
        .describe('Set to "false" to omit recent activity.'),
    },
  },
  async ({ containerTag, includeRecent }) => {
    const text = getContextPrompt(
      containerTag,
      includeRecent !== "false",
    );
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text,
          },
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
