# Open WebUI connector

Copyright (C) 2026 Rob Bloodgood. Licensed under the GNU General Public License, version 2 only. See the repository [LICENSE](../../LICENSE).

Two Open WebUI functions talk to a running OwnMemory server over HTTP. They do not open the SQLite file.

| File | Open WebUI type | What it does |
| --- | --- | --- |
| `memory_tool.py` | Workspace Tool | `recall`, `store`, and `forget` for the model to call |
| `memory_filter.py` | Filter function | Prepends matching notes before a turn, and stores the user message after one |

Both default to `http://127.0.0.1:47321` and the `openwebui` space. Change `base_url` in the function Valves when Open WebUI is not on the same host as OwnMemory. If OwnMemory is down, the filter leaves the chat unchanged.

Import each file separately in Open WebUI. A function has to be one class, so the small HTTP helper is repeated in both files.

1. Workspace → Tools → create or import, and paste `memory_tool.py`. Enable it on the model.
2. Workspace → Functions → create a filter, and paste `memory_filter.py`. Enable it globally or on the model.
