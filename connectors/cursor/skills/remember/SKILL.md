---
name: remember
description: Save a durable fact to OwnMemory with optional space/containerTag.
---

# Remember

Call OwnMemory MCP:

```
memory { action: "save", content: "<fact>", containerTag?: "<space>" }
```

Default space is `default`. Use project/repo name as `containerTag` for project facts.
