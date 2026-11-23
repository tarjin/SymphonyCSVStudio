import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normalizeAnnouncementsFeed, activeAnnouncements, plainAnnouncementText
} from "../site/SymphonyCSV_Announcements_v01.mjs";

const raw = JSON.parse(await readFile(new URL("../site/SymphonyCSV_Announcements.json", import.meta.url), "utf8"));
const normalized = normalizeAnnouncementsFeed(raw);
const now = new Date("2026-11-23T20:30:00Z");
const id = "labs-nps-feedback-2026-11-23";

test("NPS invitation is the single editorial pinned announcement", () => {
  assert.equal(normalized.messages.filter(x => x.kind !== "Sponsored" && x.pinned === true).length, 1);
  const item = normalized.messages.find(x => x.id === id);
  assert.equal(item.kind, "LABS");
  assert.equal(item.pinned, true);
  assert.equal(item.title, "LABS Feedback — Tell Us What You Think");
  assert.deepEqual(item.blocks.filter(x => x.type === "link"), [
    { type: "link", label: "Give Feedback", href: "./feedback/" }
  ]);
});
test("pinned invitation sorts before ordinary news without deleting it", () => {
  const sorted = activeAnnouncements(normalized.messages, now);
  assert.equal(sorted[0].id, id);
  assert.ok(sorted.some(x => x.id === "labs-v1-welcome-2026-11-23"));
  assert.ok(sorted.some(x => x.id === "tip-midi-getting-started-2026-11-23"));
});
test("dismissing the pin moves its announcement below regular news but keeps the link", () => {
  const sorted = activeAnnouncements(normalized.messages, now, new Set([id]));
  assert.equal(sorted[sorted.length - 1].id, id);
  assert.equal(sorted[sorted.length - 1].blocks.at(-1).href, "./feedback/");
});
test("important notices and active sponsored items keep existing priority", () => {
  const important = {
    id: "test-notice", kind: "Important Notice", published_at: "2026-11-23",
    blocks: [{ type: "paragraph", text: "Read this important notice." }]
  };
  const sponsor = {
    id: "test-sponsor", kind: "Sponsored", published_at: "2026-11-23",
    starts_at: "2026-11-23T00:00:00Z", ends_at: "2026-11-24T00:00:00Z",
    pinned: true, collapsed_by_default: true
  };
  const sorted = activeAnnouncements([...normalized.messages, sponsor, important], now);
  assert.deepEqual(sorted.slice(0, 3).map(x => x.id), ["test-notice", "test-sponsor", id]);
});
test("off-window sponsored items do not appear", () => {
  const expired = {
    id: "expired", kind: "Sponsored", published_at: "2026-11-23",
    starts_at: "2026-11-20T00:00:00Z", ends_at: "2026-11-21T00:00:00Z",
    pinned: true, collapsed_by_default: true
  };
  assert.equal(activeAnnouncements([...normalized.messages, expired], now).some(x => x.id === "expired"), false);
});
test("pinned editorial messages cannot carry sponsor fields", () => {
  const bad = structuredClone(raw);
  bad.messages[0].sponsor_name = "Inappropriate";
  assert.throws(() => normalizeAnnouncementsFeed(bad), /Sponsorship properties/);
});
test("multiple editorial pins are rejected", () => {
  const bad = structuredClone(raw);
  bad.messages[1].pinned = true;
  assert.throws(() => normalizeAnnouncementsFeed(bad), /Only one editorial announcement/);
});
test("invalid pinned state is rejected", () => {
  const bad = structuredClone(raw);
  bad.messages[0].pinned = false;
  assert.throws(() => normalizeAnnouncementsFeed(bad), /Editorial pinned property/);
});
test("copy text has exactly the approved two-question invitation and link", () => {
  const item = normalized.messages.find(x => x.id === id);
  const plain = plainAnnouncementText(item);
  assert.match(plain, /two short questions/);
  assert.match(plain, /Give Feedback \(\.\/feedback\/\)/);
  assert.doesNotMatch(plain, /sponsored by/i);
});
test("original announcement source stays below 30-message feed limit", () => {
  assert.equal(normalized.schema_version, 1);
  assert.ok(normalized.messages.length < 30);
});

test("built-in fallback includes exactly the deployed feed, including the pinned feedback link", async () => {
  const moduleText = await readFile(new URL("../site/SymphonyCSV_Announcements_v01.mjs", import.meta.url), "utf8");
  const match = moduleText.match(/const OFFLINE_WELCOME = (\\{[^\\n]*\\});/);
  assert.ok(match, "An embedded fallback feed should be present");
  const offline = JSON.parse(match[1]);
  assert.deepEqual(offline, raw);
  const pinned = normalizeAnnouncementsFeed(offline).messages[0];
  assert.equal(pinned.id, id);
  assert.equal(pinned.pinned, true);
  assert.equal(pinned.blocks.find(block => block.type === "link")?.href, "./feedback/");
});

test("Studio requests the release-pinned Announcements module, bypassing stale browser copies", async () => {
  const html = await readFile(new URL("../site/app/index.html", import.meta.url), "utf8");
  assert.match(html, /SymphonyCSV_Announcements_v01\\.mjs\\?v=labs-nps-20261123/);
});
