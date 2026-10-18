# OpenClaw connector

Memory plugin for OpenClaw. It calls a running OwnMemory server at `http://127.0.0.1:47321` (override with `baseUrl` or `OWNMEMORY_BASE_URL`).

On first load, `index.js` runs `npm install` in this folder if `typebox` is not already resolvable, then `require`s `typebox@1.3.27` from this package. OpenClaw itself still provides `openclaw/plugin-sdk`.

```bash
openclaw plugins install /absolute/path/to/ownmemory/connectors/openclaw
```
