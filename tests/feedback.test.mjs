import test from "node:test";
import assert from "node:assert/strict";
import { validateAnswers, characterCount, isUuidV4 } from "../site/feedback/validation.mjs";
import worker from "../cloudflare/feedback-worker/src/index.mjs";

const origin = "https://symphonycsvstudio.com";
const endpoint = "https://feedback.example.workers.dev/v1/feedback";
const browserId = "c0deaa11-2222-4333-8aaa-111111111111";
const submissionId = "c0deaa11-2222-4333-8aaa-222222222222";
const text = "The mixer is useful.";

function fakeDatabase() {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.startsWith("SELECT browser_id")) {
                return rows.find(row => row.submission_id === params[0]) || null;
              }
              if (sql.startsWith("SELECT submitted_at")) {
                return rows.filter(row => row.browser_id === params[0]).sort(
                  (a, b) => b.submitted_at.localeCompare(a.submitted_at)
                )[0] || null;
              }
              throw new Error("Unexpected query " + sql);
            },
            async run() {
              if (!sql.startsWith("INSERT INTO feedback_submissions")) throw new Error("Unexpected insert.");
              const [sid, bid, score, explanation, submittedAt, phase, country, region, city] = params;
              if (rows.some(row => row.submission_id === sid)) throw new Error("Duplicate ID");
              rows.push({
                submission_id: sid, browser_id: bid, score, explanation,
                submitted_at: submittedAt, product_phase: phase,
                country_code: country, region, city
              });
              return { success: true };
            }
          };
        }
      };
    }
  };
}
function env(db = fakeDatabase(), extras = {}) {
  return {
    DB: db,
    ALLOWED_ORIGINS: "https://symphonycsvstudio.com,https://www.symphonycsvstudio.com",
    PRODUCT_PHASE: "LABS",
    TURNSTILE_REQUIRED: "false", // Test fixture only; production defaults fail closed.
    ...extras
  };
}
function request(payload, extras = {}) {
  return new Request(endpoint, {
    method: extras.method || "POST",
    headers: {
      "Origin": extras.origin || origin,
      "Content-Type": extras.contentType || "application/json"
    },
    body: JSON.stringify(payload)
  });
}
function validPayload(overrides = {}) {
  return { browser_id: browserId, submission_id: submissionId, score: 9, explanation: text, ...overrides };
}

test("both questions are required", () => {
  assert.equal(validateAnswers(null, text).valid, false);
  assert.equal(validateAnswers(9, "").valid, false);
  assert.equal(validateAnswers(0, text).valid, true);
  assert.equal(validateAnswers(10, text).valid, true);
  assert.equal(validateAnswers(11, text).valid, false);
  assert.equal(validateAnswers("9", text).valid, false);
});
test("explanation is trimmed and must contain 15–2,000 Unicode code points", () => {
  assert.equal(validateAnswers(8, "  " + "a".repeat(14) + "  ").valid, false);
  assert.equal(validateAnswers(8, "  " + "a".repeat(15) + "  ").valid, true);
  assert.equal(validateAnswers(8, "x".repeat(2000)).valid, true);
  assert.equal(validateAnswers(8, "x".repeat(2001)).valid, false);
  assert.equal(validateAnswers(8, " ".repeat(2000)).valid, false);
  assert.equal(characterCount("🎸".repeat(15)), 15);
  assert.equal(validateAnswers(6, "🎸".repeat(15)).valid, true);
});
test("UUID v4 validation", () => {
  assert.equal(isUuidV4(browserId), true);
  assert.equal(isUuidV4("not-a-browser-id"), false);
  assert.equal(isUuidV4("00000000-0000-1000-8000-000000000000"), false);
});
test("CORS preflight allows only our site", async () => {
  const req = new Request(endpoint, { method: "OPTIONS", headers: { Origin: origin } });
  const response = await worker.fetch(req, env());
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  const forbidden = await worker.fetch(request(validPayload(), {origin:"https://attacker.example"}), env());
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get("Access-Control-Allow-Origin"), null);
});
test("invalid required answer is rejected server-side", async () => {
  const db = fakeDatabase();
  const response = await worker.fetch(request(validPayload({ explanation: "too short" })), env(db));
  assert.equal(response.status, 400);
  assert.equal(db.rows.length, 0);
});
test("valid survey writes one trimmed answer and approximate geolocation", async () => {
  const db = fakeDatabase();
  const req = request(validPayload({ explanation: " " + text + " " }));
  Object.defineProperty(req, "cf", { value: { country: "CA", region: "Nova Scotia", city: "Halifax" } });
  const response = await worker.fetch(req, env(db));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].score, 9);
  assert.equal(db.rows[0].explanation, text);
  assert.equal(db.rows[0].product_phase, "LABS");
  assert.equal(db.rows[0].country_code, "CA");
  assert.equal(db.rows[0].city, "Halifax");
  assert.ok(db.rows[0].submitted_at.endsWith("Z"));
  assert.equal(Object.keys(db.rows[0]).some(key => key.toLowerCase().includes("ip")), false);
});
test("retry with same submission identifier is idempotent", async () => {
  const db = fakeDatabase();
  assert.equal((await worker.fetch(request(validPayload()), env(db))).status, 201);
  const response = await worker.fetch(request(validPayload()), env(db));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).duplicate, true);
  assert.equal(db.rows.length, 1);
});
test("new submission from same UUID within 30 seconds is throttled", async () => {
  const db = fakeDatabase();
  assert.equal((await worker.fetch(request(validPayload()), env(db))).status, 201);
  const second = await worker.fetch(request(validPayload({
    submission_id: "c0deaa11-2222-4333-8aaa-333333333333"
  })), env(db));
  assert.equal(second.status, 429);
  assert.equal(db.rows.length, 1);
});
test("production Turnstile fails closed when secret is unconfigured", async () => {
  const db = fakeDatabase();
  const response = await worker.fetch(request(validPayload()), env(db, { TURNSTILE_REQUIRED: "true" }));
  assert.equal(response.status, 503);
  assert.equal(db.rows.length, 0);
});
test("POST rejects non-JSON content type", async () => {
  const response = await worker.fetch(request(validPayload(), {contentType:"text/plain"}), env());
  assert.equal(response.status, 415);
});


test("a failed D1 write must never return success", async () => {
  const db = fakeDatabase();
  const originalPrepare = db.prepare.bind(db);
  db.prepare = sql => {
    if (sql.startsWith("INSERT INTO feedback_submissions")) {
      return { bind() { return { async run() { return { success: false }; } }; } };
    }
    return originalPrepare(sql);
  };
  const response = await worker.fetch(request(validPayload()), env(db));
  assert.equal(response.status, 503);
  assert.equal(db.rows.length, 0);
});
