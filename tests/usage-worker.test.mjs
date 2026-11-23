import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/usage-worker/src/index.mjs";

const url = "https://usage.example.workers.dev/v1/event";
const origin = "https://symphonycsvstudio.com";

function database() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      if (!sql.includes("INSERT INTO usage_counts")) throw new Error("Unexpected SQL");
      return {
        bind(day, event) {
          return {
            async run() {
              const key = day + "/" + event;
              rows.set(key, (rows.get(key) || 0) + 1);
              return { success: true };
            }
          };
        }
      };
    }
  };
}
function environment(db = database()) {
  return { DB: db, ALLOWED_ORIGINS: origin + ",https://www.symphonycsvstudio.com" };
}
function req(payload, options = {}) {
  return new Request(url, {
    method: options.method || "POST",
    headers: {
      Origin: options.origin || origin,
      "Content-Type": options.contentType || "text/plain;charset=UTF-8"
    },
    body: options.body ?? JSON.stringify(payload)
  });
}

test("only allowed exact version-1 events are counted", async () => {
  const db = database();
  const env = environment(db);
  for (const event of ["studio_ready", "project_export"]) {
    const response = await worker.fetch(req({ event, version: 1 }), env);
    assert.equal(response.status, 204);
  }
  const counts = Array.from(db.rows.values());
  assert.deepEqual(counts, [1, 1]);
});
test("two matching events increase one daily aggregate counter", async () => {
  const db = database();
  const env = environment(db);
  for (let i = 0; i < 2; i++) {
    assert.equal((await worker.fetch(req({ event: "project_export", version: 1 }), env)).status, 204);
  }
  assert.equal(db.rows.size, 1);
  assert.equal(Array.from(db.rows.values())[0], 2);
});
test("extra or user-identifying fields are rejected", async () => {
  const db = database();
  const response = await worker.fetch(
    req({ event: "studio_ready", version: 1, browser_id: "not-allowed" }), environment(db)
  );
  assert.equal(response.status, 400);
  assert.equal(db.rows.size, 0);
});
test("unknown event and version are rejected", async () => {
  for (const payload of [
    { event: "play_click", version: 1 },
    { event: "studio_ready", version: 2 },
    { event: "project_export", version: "1" },
    { version: 1 },
    {}
  ]) {
    assert.equal((await worker.fetch(req(payload), environment())).status, 400);
  }
});
test("untrusted origin does not get a CORS response or a write", async () => {
  const db = database();
  const response = await worker.fetch(
    req({ event: "studio_ready", version: 1 }, { origin: "https://attacker.example" }),
    environment(db)
  );
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(db.rows.size, 0);
});
test("CORS preflight allows the public site", async () => {
  const response = await worker.fetch(new Request(url, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "POST" }
  }), environment());
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
});
test("unsupported content type is rejected", async () => {
  const response = await worker.fetch(
    req({ event: "studio_ready", version: 1 }, { contentType: "application/json" }),
    environment()
  );
  assert.equal(response.status, 415);
});
test("payload above 128 bytes is rejected", async () => {
  const db = database();
  const response = await worker.fetch(
    req({}, { body: "x".repeat(129) }), environment(db)
  );
  assert.equal(response.status, 400);
  assert.equal(db.rows.size, 0);
});
test("unconfigured D1 fails safely", async () => {
  const response = await worker.fetch(
    req({ event: "studio_ready", version: 1 }),
    { ALLOWED_ORIGINS: origin }
  );
  assert.equal(response.status, 503);
});
test("unsuccessful D1 result must not return 204", async () => {
  const failedDb = { prepare: () => ({ bind: () => ({ run: async () => ({ success: false }) }) }) };
  const response = await worker.fetch(
    req({ event: "studio_ready", version: 1 }),
    environment(failedDb)
  );
  assert.equal(response.status, 503);
});
test("health endpoint reveals no event counts", async () => {
  const response = await worker.fetch(
    new Request("https://usage.example.workers.dev/health"), environment()
  );
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.ok, true);
  assert.equal("rows" in value, false);
});
