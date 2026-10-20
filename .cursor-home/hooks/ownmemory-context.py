#!/usr/bin/env python3
"""Store and reload local OwnMemory context around Cursor turns.

This is the Mem0 stand-in: sessionStart recall + stop remember go to OwnMemory
only. Fail open: any error prints {} and exits 0. Never talk to Mem0.
"""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "http://127.0.0.1:47321"
MIN_CHARS = 40
MAX_CHARS = 1200


def emit(payload):
    sys.stdout.write(json.dumps(payload))
    sys.stdout.write("\n")


def read_input():
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def message_text(message):
    if isinstance(message, str):
        return message
    if not isinstance(message, dict):
        return ""
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text") or "")
        return "\n".join(part for part in parts if part)
    return ""


def last_user_text(transcript_path):
    path = Path(transcript_path)
    if not path.is_file():
        return ""
    last = ""
    with path.open(encoding="utf-8", errors="replace") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict) and obj.get("role") == "user":
                text = message_text(obj.get("message")).strip()
                if text:
                    last = text
    return last


def space_name(data):
    roots = data.get("workspace_roots") or data.get("workspaceRoots") or []
    if isinstance(roots, list) and roots:
        name = Path(str(roots[0])).name
        if name:
            return name
    for key in ("cwd", "workspace_root"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            name = Path(value).name
            if name:
                return name
    return "default"


def skip(text):
    if len(text) < MIN_CHARS:
        return True
    lowered = text.lower()
    if "mem0 — setup required" in lowered or "mem0 - setup required" in lowered:
        return True
    if "begin private key" in lowered or "api_key=" in lowered or "password=" in lowered:
        return True
    return False


def request(method, path, payload=None):
    body = None if payload is None else json.dumps(payload).encode()
    headers = {"content-type": "application/json"} if body else {}
    req = urllib.request.Request(API + path, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=5) as response:
        return json.loads(response.read().decode())


def remember(data):
    if data.get("agent_id"):
        return
    text = ""
    for key in ("prompt", "text", "user_message"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            text = value.strip()
            break
    if not text:
        transcript = data.get("transcript_path")
        if isinstance(transcript, str) and transcript:
            text = last_user_text(transcript)
    if skip(text):
        return
    text = text[:MAX_CHARS]
    space = space_name(data)
    query = urllib.parse.urlencode({"space": space, "limit": "8"})
    listed = request("GET", "/api/memories?" + query)
    for memory in listed.get("memories") or []:
        if (memory.get("content") or "").strip() == text:
            return
    request(
        "POST",
        "/api/memories",
        {"content": text, "action": "save", "containerTag": space},
    )


def recall(data):
    space = space_name(data)
    query = urllib.parse.urlencode({"space": space})
    profile = request("GET", "/api/profile?" + query).get("profile") or {}
    recent = profile.get("recent") or []
    if not recent:
        return False
    lines = [f"OwnMemory context for {space}:"]
    for memory in recent[:5]:
        content = (memory.get("content") or "").strip().replace("\n", " ")
        if content:
            lines.append("- " + content[:300])
    if len(lines) == 1:
        return False
    emit({"additional_context": "\n".join(lines)})
    return True


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "remember"
    data = read_input()
    try:
        if mode == "recall":
            if recall(data):
                return
        elif mode == "remember":
            remember(data)
    except (OSError, urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        pass
    emit({})


if __name__ == "__main__":
    main()
