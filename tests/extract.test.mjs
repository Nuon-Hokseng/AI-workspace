// Smallest check that fails if the background-extraction parsing breaks:
// fenced/garbled model output must degrade to empty, never throw, and the
// chat URL harvester must dedupe and trim trailing punctuation.
//
// Run with: npm test (no DB or API key needed for this file)

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExtraction, parseTeamAnalysis, findUrls } from "../lib/extract.ts";
import { planCompaction, SUMMARY_TRIGGER_COUNT, KEEP_RAW_COUNT } from "../lib/llm/history-compact.ts";

test("parseExtraction handles fenced JSON", () => {
  const raw = '```json\n{"links":[{"url":"https://nestjs.com","label":"NestJS"}],"logs":["Set up dev environment"]}\n```';
  const out = parseExtraction(raw);
  assert.deepEqual(out.links, [{ url: "https://nestjs.com", label: "NestJS" }]);
  assert.deepEqual(out.logs, ["Set up dev environment"]);
});

test("parseExtraction never throws on garbage", () => {
  for (const raw of ["", "not json", "{broken", '{"links":"nope","logs":{"x":1}}']) {
    assert.deepEqual(parseExtraction(raw), { links: [], logs: [] });
  }
});

test("parseTeamAnalysis clamps percentages and survives garbage", () => {
  const raw = '```json\n{"members":[{"name":"Ana","overall":140,"summary":"Built the API","skills":{"backend":85,"database":-5}}]}\n```';
  const [ana] = parseTeamAnalysis(raw);
  assert.equal(ana.name, "Ana");
  assert.equal(ana.overall, 100);
  assert.deepEqual(ana.skills, { backend: 85, database: 0 });
  for (const bad of ["", "nope", '{"members":"x"}', '{"members":[{"overall":50}]}']) {
    assert.deepEqual(parseTeamAnalysis(bad), []);
  }
});

test("planCompaction leaves short tails untouched", () => {
  const tail = Array.from({ length: SUMMARY_TRIGGER_COUNT }, (_, i) => i);
  const { toFold, rawTail } = planCompaction(tail);
  assert.deepEqual(toFold, []);
  assert.deepEqual(rawTail, tail);
});

test("planCompaction folds everything except the last KEEP_RAW_COUNT once over the trigger", () => {
  const tail = Array.from({ length: SUMMARY_TRIGGER_COUNT + 1 }, (_, i) => i);
  const { toFold, rawTail } = planCompaction(tail);
  assert.equal(toFold.length, tail.length - KEEP_RAW_COUNT);
  assert.equal(rawTail.length, KEEP_RAW_COUNT);
  // No gap, no overlap, no reordering across the split.
  assert.deepEqual([...toFold, ...rawTail], tail);
});

test("findUrls dedupes and strips trailing punctuation", () => {
  const urls = findUrls("see https://a.dev/x, again https://a.dev/x and http://b.io.");
  assert.deepEqual(urls, ["https://a.dev/x", "http://b.io"]);
});
