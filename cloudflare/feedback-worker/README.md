# SymphonyCSV Studio: two-question feedback service

**Status: Source code only. NOT deployed, connected, tested end-to-end or ready for live submissions.**

This implementation adds a standalone GitHub Pages page at /feedback/ and a separate Cloudflare Worker + D1 data store. Nothing in the Studio music engine needs modification. Do not merge or advertise the feedback page until the release gate passes.

## Survey contract — BOTH answers REQUIRED

1. **How likely are you to recommend SymphonyCSV Studio to another musician?** Choose an integer from 0 to 10.
2. **Why did you give that score?** Enter 15–2,000 characters after trimming surrounding whitespace.

The browser and Worker share the same validation rules in site/feedback/validation.mjs and count Unicode code points (not UTF-16 units). The page shows a live counter and does not silently truncate answers. No third question, optional comment, name, email or account.

Every submitted record stores only a random browser UUID v4, a request UUID for retry-deduplication, score, trimmed explanation, UTC timestamp, LABS/BETA phase, and available approximate country/region/city metadata. No raw IP address is stored in D1, and the Worker does not log survey answers or identifying headers. The browser UUID is in localStorage separately from Studio's Save to Browser/IndexedDB. Resetting the local UUID leaves previously submitted answers on the server.

## Setup — requires the owner's Cloudflare account

Run these steps from cloudflare/feedback-worker/:

1. Sign in to Cloudflare with Wrangler. Example: npx wrangler@latest login
2. Create a D1 database: npx wrangler@latest d1 create symphonycsv-feedback . Capture the real database_id.
3. Copy wrangler.toml.example to wrangler.toml, replace the placeholder database_id, and retain TURNSTILE_REQUIRED = "true" and PRODUCT_PHASE = "LABS".
4. Apply the migration to the remote database: npx wrangler@latest d1 migrations apply symphonycsv-feedback --remote
5. Create a Turnstile widget for symphonycsvstudio.com (and www.symphonycsvstudio.com, if used). Select Managed mode and capture the public site key and private secret.
6. Set the secret with npx wrangler@latest secret put TURNSTILE_SECRET . NEVER put the secret in GitHub, wrangler.toml or public JavaScript.
7. Deploy the Worker: npx wrangler@latest deploy . Capture the deployed HTTPS URL.
8. Edit the two PUBLIC values in site/feedback/config.js: apiUrl must be the deployed Worker URL ending in /v1/feedback, and turnstileSiteKey is the public Turnstile site key. The page deliberately disables submission when either is blank.
9. Publish the site only after end-to-end verification, then add /feedback/ to Help navigation and optionally pin a remote announcement.

No Cloudflare management connection is available in this ChatGPT session. GitHub merging alone cannot provision a D1 database, configure Turnstile, or deploy a Worker.

## Verification / release gate

- Run node --test tests/feedback.test.mjs from the repository root. The tests exercise the real validation module and Worker handler against a fake D1 database.
- Confirm /health responds, the D1 binding is actually attached, and the remote migration has applied. A healthy Worker alone does NOT prove database writes succeed.
- In a deployed browser test, send a real valid submission and confirm the row appears in D1. Test both boundary scores (0 and 10), exactly 15 Unicode code points, exactly 2,000, and the recorded UTC timestamp.
- Test missing score, 14-character text, 2,001-character text, whitespace-only text, invalid JSON, rejected origin, Turnstile failure, duplicate retries, server outages, mobile layout, keyboard controls, focus behavior, and a screen reader.
- Verify UUID continuity across refreshes and the reset function. Confirm it never affects saved Studio music.
- Review actual Cloudflare logging policies, database access permissions, owner-only export strategy, data retention/deletion rules, and the final privacy notice before real public collection. Users may incidentally provide personal information in free text.
- Do not advertise or enable the form until one complete request has passed from browser to D1 and the actual stored row has been verified.

## Owner-only quarterly analysis (future)

Do not expose a public analytics API. Use private D1 exports to compute the primary quarterly NPS from the **latest score per browser UUID within that calendar quarter** (9–10 promoters; 7–8 passives; 0–6 detractors). Separately label any history-averaged category-contribution calculation as a custom measure. Report response counts and distinct browser identifiers, not verified unique people.

Cloudflare documentation:
- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/d1/worker-api/prepared-statements/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/workers/runtime-apis/request/
