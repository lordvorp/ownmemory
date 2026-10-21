import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmbedServer } from "./server";

function listen(server: import("node:http").Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("no port"));
        return;
      }
      resolve(`http://127.0.0.1:${addr.port}`);
    });
  });
}

describe("createEmbedServer", () => {
  it("health returns ready flag and dims", async () => {
    let ready = false;
    const server = createEmbedServer({
      embed: async () => new Float32Array(384),
      health: {
        engine: "arctic-s",
        model: "Snowflake/snowflake-arctic-embed-s",
        dims: 384,
        pooling: "cls",
      },
      isReady: () => ready,
    });
    const base = await listen(server);
    try {
      const cold = await fetch(`${base}/health`).then((r) => r.json());
      assert.equal(cold.ok, true);
      assert.equal(cold.ready, false);
      assert.equal(cold.engine, "arctic-s");
      assert.equal(cold.dims, 384);
      ready = true;
      const hot = await fetch(`${base}/health`).then((r) => r.json());
      assert.equal(hot.ready, true);
    } finally {
      server.close();
    }
  });

  it("embed returns 384 floats and passes role", async () => {
    const roles: string[] = [];
    const server = createEmbedServer({
      embed: async (text, role) => {
        roles.push(role);
        const v = new Float32Array(384);
        v[0] = text.length;
        return v;
      },
      health: {
        engine: "arctic-s",
        model: "Snowflake/snowflake-arctic-embed-s",
        dims: 384,
        pooling: "cls",
      },
      isReady: () => true,
    });
    const base = await listen(server);
    try {
      const res = await fetch(`${base}/v1/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "cats", role: "query" }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.engine, "arctic-s");
      assert.equal(body.dims, 384);
      assert.equal(body.embedding.length, 384);
      assert.equal(body.embedding[0], 4);
      assert.deepEqual(roles, ["query"]);
    } finally {
      server.close();
    }
  });

  it("rejects malformed JSON with 400", async () => {
    const server = createEmbedServer({
      embed: async () => new Float32Array(384),
      health: { engine: "arctic-s", model: "x", dims: 384, pooling: "cls" },
      isReady: () => true,
    });
    const base = await listen(server);
    try {
      const res = await fetch(`${base}/v1/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error, "invalid JSON");
    } finally {
      server.close();
    }
  });

  it("rejects empty text with 400", async () => {
    const server = createEmbedServer({
      embed: async () => new Float32Array(384),
      health: { engine: "arctic-s", model: "x", dims: 384, pooling: "cls" },
      isReady: () => true,
    });
    const base = await listen(server);
    try {
      const res = await fetch(`${base}/v1/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "  ", role: "document" }),
      });
      assert.equal(res.status, 400);
    } finally {
      server.close();
    }
  });
});
