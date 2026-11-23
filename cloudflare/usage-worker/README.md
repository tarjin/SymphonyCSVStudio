# SymphonyCSV Studio — privacy-conscious aggregate usage service

**Status: source prepared; NOT connected to Cloudflare or confirmed live.**

The released Studio already sends only two approved events in a standalone, nonbundled JavaScript module. This Worker accepts exactly that contract and stores **daily counts**, not event-level records, visitor IDs, IPs or any music data.

| Source | Metric | What it means |
|---|---|---|
| Cloudflare Web Analytics (separate) | Website/app pageviews and visits | Page was viewed; not proof Studio booted |
| Studio standalone reporter | studio_ready | Core UI started successfully; lazy WASM/SoundFonts might still be pending |
| Studio standalone reporter | project_export | One logical Project ZIP export initiated, even with Music+Audio paired downloads |

Do not present these events as verified unique musicians, song completions or retained files.

## Cloudflare setup — uses a separate D1 database

All commands below run from the "cloudflare/usage-worker" folder after signing in to your own Cloudflare account. No Cloudflare credentials belong in GitHub or chat.

1. Run "npx wrangler@latest login".
2. Run "npx wrangler@latest d1 create symphonycsv-usage". Capture the actual database ID from the response.
3. Copy wrangler.toml.example to wrangler.toml, and replace the placeholder database_id with that ID. Do not commit your local wrangler.toml.
4. Run "npx wrangler@latest d1 migrations apply symphonycsv-usage --remote".
5. Run "npx wrangler@latest deploy" and record the actual Worker HTTPS URL.
6. Check its "/health" route; it should report databaseConfigured=true. This alone does not prove that the migration or increment works.
7. Update the PUBLIC file site/analytics-config.js with enabled: true and endpoint: "<actual HTTPS Worker URL>/v1/event". Keep the endpoint URL free of credentials.
8. Publish that config file only after a real production Studio page load and test Project ZIP export have been observed in D1. To pause reporting at any time, set enabled:false without rebuilding Rust/WASM.

For a quick read-only check in the Cloudflare dashboard, open D1 > symphonycsv-usage > Console and run:

SELECT day_utc, event_name, count
FROM usage_counts ORDER BY day_utc DESC, event_name;

Expected columns are only day_utc, event_name and count. All timestamps are UTC calendar dates. For a production test, confirm that the test action increments the expected row exactly once and that blocking the endpoint never breaks music or Project ZIP download.

**Security boundary:** Origin allowlisting, exact allowlisted event JSON, a 128-byte maximum request body and D1 aggregate-only storage reduce risk but do not authenticate public events. Non-browser clients can forge allowed origins. Do not portray the counts as tamper-proof. Consider Cloudflare WAF/rate rules and monitor traffic anomalies; never introduce per-musician identifiers merely to improve deduplication.

## Website traffic — Cloudflare Web Analytics

Create the site under Cloudflare > Web Analytics for "symphonycsvstudio.com". Our website is hosted by GitHub Pages, so use the **manual beacon** installation mode rather than expecting Cloudflare to inject it into GitHub Pages. Cloudflare provides a PUBLIC site token; put that value in site/cloudflare-web-analytics-config.js and set enabled:true.

The separate loader site/cloudflare-web-analytics.js inserts the official beacon script only when configured. With token unset or enabled:false, it sends nothing. It respects GPC/DNT at our integration boundary. The loader appears on the homepage, Studio, Help, CSV reference and MIDI workspace pages; no changes to the music engine are required. It does not use the NPS browser UUID.

Verify real pageview reporting in Cloudflare Web Analytics for / and /app/. A site pageview is separate from the studio_ready custom event.

## Release gate

- Run from repository root: "node --test tests/usage-worker.test.mjs".
- Validate exact event/JSON contract, content-type, origin, invalid data, response codes, aggregate-only D1 records, local mock tests and a real remote D1 increment.
- Confirm Web Analytics token and manually injected beacon load on the actual GitHub Pages site, HTTPS and navigation behaviour, and the published Help privacy disclosure.
- Confirm Studio's existing config and reporter scripts load under /app/ and do not block Project ZIP downloads even if Worker is inaccessible.
- Record activation date, actual Worker deployment URL, counted event definitions, known gaps and periodic dated aggregate exports. Do not invent historical usage before activation.
- Never enable public analytics while the endpoint fails or the privacy disclosure is inaccurate.

## Privacy and rollback

No identifiers, titles, audio, files, musical data or IPs are written to the usage D1 schema. Cloudflare infrastructure still handles ordinary connection information. The feedback survey uses a *different* service and separate database, with pseudonymous UUIDs and the two required questions. The usage counter is intentionally not joinable to survey records.

Disable by setting enabled:false in the separately published site/analytics-config.js and site/cloudflare-web-analytics-config.js. Existing stored D1 daily counters remain unless removed by the owner.

Official references:
https://developers.cloudflare.com/d1/get-started/
https://developers.cloudflare.com/d1/reference/migrations/
https://developers.cloudflare.com/web-analytics/get-started/
