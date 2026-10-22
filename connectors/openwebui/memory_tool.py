"""
title: OwnMemory
author: Rob Bloodgood
version: 0.1.0
license: MIT
description: Search, store, and forget notes in a local OwnMemory server.
requirements:
"""

# OwnMemory — local-first persistent memory for AI agents.
# Copyright (C) 2026 Rob Bloodgood
# SPDX-License-Identifier: MIT
#
# Licensed under the MIT License. See the LICENSE file.

import json
import urllib.error
import urllib.parse
import urllib.request

from pydantic import BaseModel, Field

MIN_CHARS = 40
MAX_CHARS = 1200


def clip(text: str) -> str:
    value = " ".join(str(text).split())
    if len(value) <= MAX_CHARS:
        return value
    return value[:MAX_CHARS].rstrip() + "…"


def skip_text(text: str) -> bool:
    value = " ".join(str(text or "").split())
    if len(value) < MIN_CHARS or len(value) > 20000:
        return True
    lower = value.lower()
    return (
        "mem0 — setup required" in lower
        or "mem0 - setup required" in lower
        or "begin private key" in lower
        or "api_key=" in lower
        or "password=" in lower
    )


def own_fetch(base_url: str, path: str, method: str = "GET", payload: dict | None = None, timeout: float = 4.0):
    url = base_url.rstrip("/") + path
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode()
    except urllib.error.HTTPError as err:
        detail = err.read().decode(errors="replace")
        try:
            message = json.loads(detail).get("error") or detail
        except json.JSONDecodeError:
            message = detail or f"OwnMemory HTTP {err.code}"
        raise RuntimeError(str(message)) from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"OwnMemory unreachable at {base_url}: {err.reason}") from err
    if not raw:
        return {}
    return json.loads(raw)


class Tools:
    class Valves(BaseModel):
        base_url: str = Field(
            default="http://127.0.0.1:47321",
            description="OwnMemory server. Use the host address if Open WebUI runs in another container.",
        )
        space: str = Field(
            default="openwebui",
            description="Space name used when storing a note.",
        )
        timeout_seconds: float = Field(
            default=4.0,
            description="HTTP timeout in seconds.",
        )

    def __init__(self):
        self.valves = self.Valves()

    def recall(self, query: str, limit: int = 5) -> str:
        """
        Search local OwnMemory notes across every space.
        :param query: What to look for.
        :param limit: Maximum number of notes to return.
        :return: Matching notes, including each note id.
        """
        text = str(query or "").strip()
        if not text:
            return "Provide a query."
        body = own_fetch(
            self.valves.base_url,
            "/api/search",
            method="POST",
            payload={"query": text, "includeProfile": False, "limit": int(limit) or 5},
            timeout=self.valves.timeout_seconds,
        )
        results = body.get("results") or []
        if not results:
            return "No matching OwnMemory notes."
        lines = []
        for memory in results:
            where = memory.get("spaceName") or "unknown"
            lines.append(f"{memory.get('id')} [{where}] {clip(memory.get('content', ''))}")
        return "\n".join(lines)

    def store(self, content: str, space: str = "") -> str:
        """
        Save a durable note in local OwnMemory.
        :param content: The fact to remember.
        :param space: Space name. Leave empty to use the configured space.
        :return: Whether the note was stored or was already present.
        """
        text = clip(content)
        if skip_text(text):
            return "Skipped. Note is too short or looks like a secret."
        target = (space or self.valves.space or "openwebui").strip()
        recent = own_fetch(
            self.valves.base_url,
            f"/api/memories?space={urllib.parse.quote(target)}&limit=8",
            timeout=self.valves.timeout_seconds,
        )
        if any(memory.get("content") == text for memory in recent.get("memories") or []):
            return f"Already stored in {target}."
        own_fetch(
            self.valves.base_url,
            "/api/memories",
            method="POST",
            payload={"content": text, "action": "save", "containerTag": target},
            timeout=self.valves.timeout_seconds,
        )
        return f"Stored in {target}."

    def forget(self, memory_id: str) -> str:
        """
        Forget an OwnMemory note by id.
        :param memory_id: Note id returned by recall.
        :return: Whether the note was removed.
        """
        memory_id = str(memory_id or "").strip()
        if not memory_id:
            return "Provide memory_id."
        result = own_fetch(
            self.valves.base_url,
            f"/api/memories?id={urllib.parse.quote(memory_id)}",
            method="DELETE",
            timeout=self.valves.timeout_seconds,
        )
        if result.get("ok"):
            return f"Forgot {memory_id}."
        return f"No memory {memory_id}."
