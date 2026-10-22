"""
title: OwnMemory Recall
author: Rob Bloodgood
version: 0.1.0
license: MIT
description: Recall relevant OwnMemory notes before a turn and store the user message when the turn ends.
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


def message_text(message: dict) -> str:
    content = message.get("content")
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text" and isinstance(block.get("text"), str):
            parts.append(block["text"])
    return "\n".join(parts)


def last_user_text(messages: list) -> str:
    for message in reversed(messages or []):
        if isinstance(message, dict) and message.get("role") == "user":
            return message_text(message)
    return ""


def last_capturable_text(messages: list) -> str:
    chosen = ""
    for message in messages or []:
        if not isinstance(message, dict) or message.get("role") != "user":
            continue
        text = clip(message_text(message))
        if not skip_text(text):
            chosen = text
    return chosen


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


class Filter:
    class Valves(BaseModel):
        base_url: str = Field(
            default="http://127.0.0.1:47321",
            description="OwnMemory server. Use the host address if Open WebUI runs in another container.",
        )
        space: str = Field(
            default="openwebui",
            description="Space used when auto-capture stores a user message.",
        )
        auto_recall: bool = Field(
            default=True,
            description="Prepend matching notes before the model sees the turn.",
        )
        auto_capture: bool = Field(
            default=True,
            description="Store the latest user message after a completed turn.",
        )
        timeout_seconds: float = Field(
            default=4.0,
            description="HTTP timeout in seconds.",
        )
        priority: int = Field(
            default=0,
            description="Filter order. Lower values run first.",
        )

    def __init__(self):
        self.valves = self.Valves()

    def _search(self, query: str) -> list:
        body = own_fetch(
            self.valves.base_url,
            "/api/search",
            method="POST",
            payload={"query": clip(query), "includeProfile": False, "limit": 5},
            timeout=self.valves.timeout_seconds,
        )
        results = body.get("results")
        return results if isinstance(results, list) else []

    def _save(self, content: str) -> None:
        space = (self.valves.space or "openwebui").strip()
        recent = own_fetch(
            self.valves.base_url,
            f"/api/memories?space={urllib.parse.quote(space)}&limit=8",
            timeout=self.valves.timeout_seconds,
        )
        if any(memory.get("content") == content for memory in recent.get("memories") or []):
            return
        own_fetch(
            self.valves.base_url,
            "/api/memories",
            method="POST",
            payload={"content": content, "action": "save", "containerTag": space},
            timeout=self.valves.timeout_seconds,
        )

    async def inlet(self, body: dict, __user__: dict | None = None) -> dict:
        if not self.valves.auto_recall:
            return body
        messages = body.get("messages") or []
        prompt = last_user_text(messages)
        if skip_text(prompt):
            return body
        try:
            results = self._search(prompt)
        except Exception:
            return body
        lines = []
        for memory in results[:5]:
            where = f"{memory.get('spaceName')}: " if memory.get("spaceName") else ""
            lines.append(f"- {where}{clip(memory.get('content', ''))[:300]}")
        if not lines:
            return body
        context = "OwnMemory context:\n" + "\n".join(lines)
        body["messages"] = [{"role": "system", "content": context}, *messages]
        return body

    async def outlet(self, body: dict, __user__: dict | None = None) -> dict:
        if not self.valves.auto_capture:
            return body
        text = last_capturable_text(body.get("messages") or [])
        if not text:
            return body
        try:
            self._save(text)
        except Exception:
            return body
        return body
