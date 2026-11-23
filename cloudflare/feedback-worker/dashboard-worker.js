/* SymphonyCSV LABS Feedback — standalone Cloudflare dashboard Worker.
   Paste this entire file into worker.js in Cloudflare's browser editor.
   Generated from site/feedback/validation.mjs + src/index.mjs.
   The secret TURNSTILE_SECRET stays in Cloudflare: never paste it here. */

// Shared browser/Worker rules. Count Unicode code points after trimming.
const MIN_EXPLANATION_LENGTH = 15;
const MAX_EXPLANATION_LENGTH = 2000;

function characterCount(value) {
  return Array.from(String(value)).length;
}

function isUuidV4(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateAnswers(score, explanation) {
  const errors = {};
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    errors.score = "Choose a rating from 0 to 10.";
  }
  if (typeof explanation !== "string") {
    errors.explanation = "Explain why you gave that score.";
    return { valid: false, errors, explanation: "", count: 0 };
  }

  const trimmed = explanation.trim();
  const count = characterCount(trimmed);
  if (count < MIN_EXPLANATION_LENGTH) {
    errors.explanation = "Please write at least 15 characters explaining your rating.";
  } else if (count > MAX_EXPLANATION_LENGTH) {
    errors.explanation = "Please shorten your explanation to 2,000 characters or fewer.";
  }
  return { valid: Object.keys(errors).length === 0, errors, explanation: trimmed, count };
}


const MAX_REQUEST_BYTES = 16384;
const MIN_SECONDS_BETWEEN_SUBMISSIONS = 30;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function isAllowedOrigin(origin, env) {
  if (!origin || !env?.ALLOWED_ORIGINS) return false;
  return env.ALLOWED_ORIGINS.split(",").map(value => value.trim()).includes(origin);
}

function reply(data, status, origin = null, otherHeaders = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...otherHeaders
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

async function limitedJson(request) {
  if (!request.body) throw new Error("Request body is empty.");
  const reader = request.body.getReader();
  let length = 0;
  const chunks = [];
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_REQUEST_BYTES) throw new Error("Request is too large.");
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  const body = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(combined);
  return JSON.parse(body);
}

function geo(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || null : null;
}

async function verifyTurnstile(token, origin, env) {
  // Production configuration requires Turnstile by default. Disable only for local tests.
  if (env.TURNSTILE_REQUIRED === "false") return true;
  if (!env.TURNSTILE_SECRET || typeof token !== "string" || !token) return false;
  try {
    const form = new URLSearchParams({
      secret: env.TURNSTILE_SECRET,
      response: token
    });
    const response = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true && result.hostname === new URL(origin).hostname;
  } catch (_error) {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const trusted = isAllowedOrigin(origin, env);

    if (url.pathname === "/health" && request.method === "GET") {
      return reply({ ok: true, service: "symphonycsv-feedback", databaseConfigured: Boolean(env.DB) }, 200);
    }
    if (url.pathname !== "/v1/feedback") return reply({ ok: false, message: "Not found." }, 404);
    if (!trusted) return reply({ ok: false, message: "Origin not permitted." }, 403);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
        "Cache-Control": "no-store",
        "Vary": "Origin"
      } });
    }
    if (request.method !== "POST") {
      return reply({ ok: false, message: "Method not allowed." }, 405, origin, { "Allow": "POST, OPTIONS" });
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) {
      return reply({ ok: false, message: "Content-Type must be application/json." }, 415, origin);
    }
    if (!env.DB) return reply({ ok: false, message: "Feedback service is not configured." }, 503, origin);
    if (env.TURNSTILE_REQUIRED !== "false" && !env.TURNSTILE_SECRET) {
      return reply({ ok: false, message: "Feedback verification is not configured." }, 503, origin);
    }

    let payload;
    try { payload = await limitedJson(request); }
    catch (_error) { return reply({ ok: false, message: "Invalid or oversized JSON request." }, 400, origin); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return reply({ ok: false, message: "Expected a feedback object." }, 400, origin);
    }
    const checked = validateAnswers(payload.score, payload.explanation);
    if (!checked.valid || !isUuidV4(payload.browser_id) || !isUuidV4(payload.submission_id)) {
      return reply({ ok: false, message: "Please provide a 0–10 score and a 15–2,000-character explanation.", errors: checked.errors }, 400, origin);
    }

    try {
      const existing = await env.DB.prepare(
        "SELECT browser_id FROM feedback_submissions WHERE submission_id = ?"
      ).bind(payload.submission_id).first();
      if (existing) {
        // Retry after a network timeout: save only once, never overwrite prior feedback.
        return existing.browser_id === payload.browser_id
          ? reply({ ok: true, duplicate: true }, 200, origin)
          : reply({ ok: false, message: "Submission identifier already used." }, 409, origin);
      }

      const previous = await env.DB.prepare(
        "SELECT submitted_at FROM feedback_submissions WHERE browser_id = ? ORDER BY submitted_at DESC, id DESC LIMIT 1"
      ).bind(payload.browser_id).first();
      if (previous && Date.now() - Date.parse(previous.submitted_at) < MIN_SECONDS_BETWEEN_SUBMISSIONS * 1000) {
        return reply(
          { ok: false, message: "Please wait briefly before submitting again." },
          429, origin, { "Retry-After": String(MIN_SECONDS_BETWEEN_SUBMISSIONS) }
        );
      }

      const verified = await verifyTurnstile(payload.turnstile_token, origin, env);
      if (!verified) return reply({ ok: false, message: "Spam-protection verification failed. Please retry." }, 400, origin);

      const submittedAt = new Date().toISOString();
      const cf = request.cf || {};
      const country = geo(cf.country, 2);
      const region = geo(cf.region, 100);
      const city = geo(cf.city, 100);
      const phase = env.PRODUCT_PHASE === "BETA" ? "BETA" : "LABS";
      const writeResult = await env.DB.prepare(
        "INSERT INTO feedback_submissions (submission_id, browser_id, score, explanation, submitted_at, product_phase, country_code, region, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        payload.submission_id, payload.browser_id, payload.score, checked.explanation,
        submittedAt, phase, country, region, city
      ).run();
      if (!writeResult || writeResult.success !== true) throw new Error("D1 write not confirmed.");
      return reply({ ok: true }, 201, origin);
    } catch (_error) {
      // Never log survey text, browser identifiers, raw IP addresses or request bodies.
      return reply({ ok: false, message: "Feedback could not be saved. Please try again later." }, 503, origin);
    }
  }
};
