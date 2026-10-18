import { countActiveMemories, listActiveMemories } from "./store";
import type { Profile } from "./types";

const PREFERENCE_HINT =
  /\b(prefer|preference|always|never|don't|do not|likes?|hates?|favorite|favourite|usually|default|my name is|i am|i'm)\b/i;

export function buildProfile(containerTag?: string): Profile {
  const spaceName = containerTag?.trim() || "default";
  const recent = listActiveMemories(spaceName, 12);
  const pool = listActiveMemories(spaceName, 80);
  const memoryCount = countActiveMemories(spaceName);

  const stable = pool
    .filter((m) => PREFERENCE_HINT.test(m.content))
    .slice(0, 12)
    .map((m) => m.content);

  // Fall back to oldest-ish durable facts if no preference language matched
  if (stable.length === 0) {
    const oldest = [...pool]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, 6)
      .map((m) => m.content);
    stable.push(...oldest);
  }

  const summaryParts = [
    stable.length
      ? `Stable preferences / facts:\n${stable.map((s) => `- ${s}`).join("\n")}`
      : "No stable preferences stored yet.",
    recent.length
      ? `Recent activity:\n${recent
          .slice(0, 5)
          .map((m) => `- ${m.content}`)
          .join("\n")}`
      : "No recent memories.",
  ];

  return {
    spaceName,
    stable,
    recent,
    summary: summaryParts.join("\n\n"),
    memoryCount,
  };
}

export function formatContextPrompt(
  profile: Profile,
  includeRecent = true,
): string {
  const lines = [
    "You have access to OwnMemory, a local persistent memory store running on the user's machine.",
    "When you learn durable facts, preferences, or decisions, save them with the `memory` tool (action=save).",
    "When a fact is outdated or wrong, call `memory` with action=forget.",
    "",
    `Active space: ${profile.spaceName}`,
    `Stored memories: ${profile.memoryCount}`,
    "",
  ];

  if (profile.stable.length) {
    lines.push("Stable preferences / facts:");
    for (const item of profile.stable) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (includeRecent && profile.recent.length) {
    lines.push("Recent activity:");
    for (const item of profile.recent.slice(0, 5)) {
      lines.push(`- ${item.content}`);
    }
  }

  if (!profile.stable.length && !profile.recent.length) {
    lines.push(
      "No profile data yet. Ask clarifying questions when needed, then save lasting facts.",
    );
  }

  return lines.join("\n");
}
