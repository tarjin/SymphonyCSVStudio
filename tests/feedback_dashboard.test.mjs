import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "../cloudflare/feedback-worker/dashboard-worker.js";
import original from "../cloudflare/feedback-worker/src/index.mjs";

const base = new URL("../", import.meta.url);
const [shared, modular, standalone] = await Promise.all([
  readFile(new URL("site/feedback/validation.mjs", base), "utf8"),
  readFile(new URL("cloudflare/feedback-worker/src/index.mjs", base), "utf8"),
  readFile(new URL("cloudflare/feedback-worker/dashboard-worker.js", base), "utf8")
]);
const importLine = 'import { isUuidV4, validateAnswers } from "../../../site/feedback/validation.mjs";\n';
const expected = [
  "/* SymphonyCSV LABS Feedback — standalone Cloudflare dashboard Worker.",
  "   Paste this entire file into worker.js in Cloudflare's browser editor.",
  "   Generated from site/feedback/validation.mjs + src/index.mjs.",
  "   The secret TURNSTILE_SECRET stays in Cloudflare: never paste it here. */",
  "",
  shared.replaceAll(/^export /gm, ""),
  modular.slice(importLine.length)
].join("\n");

test("dashboard Worker is identical to canonical modular implementation with shared validation inlined", () => {
  assert.ok(modular.startsWith(importLine));
  assert.equal(standalone, expected);
  assert.doesNotMatch(standalone, /^import /m);
});

test("dashboard Worker exposes the configured health endpoint", async () => {
  const r = await worker.fetch(new Request("https://feedback.example/health"), {DB: {}});
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {ok:true, service:"symphonycsv-feedback", databaseConfigured:true});
});

test("dashboard Worker rejects untrusted origins", async () => {
  const r = await worker.fetch(new Request("https://feedback.example/v1/feedback", {
    method:"POST", headers:{Origin:"https://attacker.example","Content-Type":"application/json"},
    body:'{}'
  }), {ALLOWED_ORIGINS:"https://symphonycsvstudio.com"});
  assert.equal(r.status, 403);
});

test("dashboard Worker has the same fail-closed verification behavior as modular Worker", async () => {
  const origin = "https://symphonycsvstudio.com";
  const request = () => new Request("https://feedback.example/v1/feedback", {
    method: "POST",
    headers:{Origin:origin,"Content-Type":"application/json"},
    body:JSON.stringify({
      browser_id:"c0deaa11-2222-4333-8aaa-111111111111",
      submission_id:"c0deaa11-2222-4333-8aaa-222222222222",
      score:9, explanation:"The mixer is useful."
    })
  });
  const env = {DB:{},ALLOWED_ORIGINS:origin,TURNSTILE_REQUIRED:"true"};
  const [a,b] = await Promise.all([worker.fetch(request(),env),original.fetch(request(),env)]);
  assert.equal(a.status,503);
  assert.equal(a.status,b.status);
});
