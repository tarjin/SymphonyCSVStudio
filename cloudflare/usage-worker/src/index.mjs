/* Aggregate Studio telemetry: no browser UUID, cookies, raw IP or music data stored.
   Exactly two events from the prewired Studio RC1 reporting module. */
const EVENTS = new Set(["studio_ready", "project_export"]);
const MAX_BYTES = 128;

function permittedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim());
  return origin && allowed.includes(origin) ? origin : null;
}

function answer(status, origin, data = null) {
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {})
  };
  if (data !== null) headers["Content-Type"] = "application/json; charset=utf-8";
  return new Response(data === null ? null : JSON.stringify(data), { status, headers });
}

async function readSmallText(request) {
  if (!request.body) throw new Error("Missing event");
  const stream = request.body.getReader();
  const parts = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await stream.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await stream.cancel().catch(() => {});
        throw new Error("Too large");
      }
      parts.push(value);
    }
  } finally { stream.releaseLock(); }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) { buffer.set(part, offset); offset += part.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/health" && request.method === "GET") {
      return answer(200, null, { ok: true, service: "symphonycsv-usage", databaseConfigured: Boolean(env.DB) });
    }
    if (pathname !== "/v1/event") return answer(404, null, { ok: false });
    const origin = permittedOrigin(request, env);
    if (!origin) return answer(403, null, { ok: false });

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
    if (request.method !== "POST") return answer(405, origin, { ok: false });
    if (!/^text\/plain(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) {
      return answer(415, origin, { ok: false });
    }
    if (!env.DB) return answer(503, origin, { ok: false });

    let payload;
    try {
      payload = JSON.parse(await readSmallText(request));
    } catch (_error) {
      return answer(400, origin, { ok: false });
    }
    if (!payload || Array.isArray(payload) || typeof payload !== "object" ||
        Object.keys(payload).length !== 2 || !EVENTS.has(payload.event) || payload.version !== 1) {
      return answer(400, origin, { ok: false });
    }

    // One UTC row per day and event. Atomic upsert, no per-request details retained.
    const dayUtc = new Date().toISOString().slice(0, 10);
    try {
      const result = await env.DB.prepare(
        "INSERT INTO usage_counts (day_utc, event_name, count) VALUES (?, ?, 1) " +
        "ON CONFLICT(day_utc, event_name) DO UPDATE SET count = count + 1"
      ).bind(dayUtc, payload.event).run();
      if (!result || result.success !== true) throw new Error("Write unconfirmed");
      return answer(204, origin);
    } catch (_error) {
      // Fail silently for musicians; app's one-way reporter never awaits this.
      return answer(503, origin, { ok: false });
    }
  }
};
