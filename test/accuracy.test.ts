// SPDX-License-Identifier: Apache-2.0
// Accuracy gate — the credibility centerpiece.
// Each fixture is a real issue we hand-graded during manual triage. We assert the FULL pipeline
// (mapIssueNode -> assessIssue) reproduces our human verdict. If the engine ever regresses on a
// known case, this fails.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mergeMentionedPullRequests } from "../src/analyze.js";
import { type RawIssueNode, mapIssueNode } from "../src/github.js";
import { extractReferences } from "../src/mentions.js";
import { assessIssue } from "../src/rubric.js";
import type { Verdict } from "../src/types.js";

// Fixed clock so staleness is deterministic (matches when we did the triage).
const NOW = Date.parse("2026-08-18T00:00:00Z");

function load(name: string): RawIssueNode {
  const path = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as RawIssueNode;
}

interface KnownAnswer {
  fixture: string;
  owner: string;
  repo: string;
  expected: Verdict;
  because: string;
  /** A signal code we expect to appear in the evidence (proves WHY, not just the label). */
  expectEvidence: string;
}

const KNOWN_ANSWERS: KnownAnswer[] = [
  {
    fixture: "jackson-6136.json",
    owner: "FasterXML",
    repo: "jackson-databind",
    expected: "TAKEN",
    because: "open PR #6134 already fixes it",
    expectEvidence: "open_pr",
  },
  {
    fixture: "graphql-4433.json",
    owner: "graphql-java",
    repo: "graphql-java",
    expected: "TAKEN",
    because: "open PR #4435 already fixes it",
    expectEvidence: "open_pr",
  },
  {
    fixture: "toml-1120.json",
    owner: "toml-rs",
    repo: "toml",
    expected: "CONTENTIOUS",
    because: "maintainer said won't-fix + two closed-unmerged PRs",
    expectEvidence: "maintainer_negative",
  },
  {
    fixture: "issue-3119.json",
    owner: "smithy-lang",
    repo: "smithy",
    expected: "CONTENTIOUS",
    because: "reopened after two closed PRs (maintainer-staged) + needs-discussion label",
    expectEvidence: "closed_unmerged_pr",
  },
  {
    fixture: "clean-control.json",
    owner: "acme",
    repo: "widgets",
    expected: "CLEAN",
    because: "fresh, unclaimed, good-first-issue, maintainer welcomed a PR",
    expectEvidence: "positive_label",
  },
];

describe("accuracy gate — known-answer set reproduces hand-grading", () => {
  for (const ka of KNOWN_ANSWERS) {
    it(`${ka.owner}/${ka.repo} (${ka.fixture}) -> ${ka.expected} (${ka.because})`, () => {
      const snap = mapIssueNode(ka.owner, ka.repo, load(ka.fixture));
      const result = assessIssue(snap, { now: NOW });
      expect(result.verdict).toBe(ka.expected);
      expect(result.evidence.map((e) => e.code)).toContain(ka.expectEvidence);
    });
  }

  it("ranks the CLEAN control above the TAKEN/CONTENTIOUS ones by score", () => {
    const scoreOf = (fixture: string, owner: string, repo: string): number =>
      assessIssue(mapIssueNode(owner, repo, load(fixture)), { now: NOW }).score;

    const clean = scoreOf("clean-control.json", "acme", "widgets");
    const taken = scoreOf("jackson-6136.json", "FasterXML", "jackson-databind");
    const contentious = scoreOf("toml-1120.json", "toml-rs", "toml");

    expect(clean).toBeGreaterThan(taken);
    expect(clean).toBeGreaterThan(contentious);
  });

  // v0.2: prose-mentioned PRs (toml-rs/toml#1008). The closed PR #1195 is referenced only in a
  // comment, so there is NO timeline event. v0.1 wrongly reported CLEAN; v0.2 must catch it.
  it("toml-rs/toml#1008 -> CONTENTIOUS via prose-mentioned closed PR #1195 (v0.2 regression)", () => {
    const snap = mapIssueNode("toml-rs", "toml", load("toml-1008.json"));

    // v0.1 behavior (timeline only): no PRs seen -> CLEAN. This is the bug we fixed.
    expect(snap.linkedPullRequests).toHaveLength(0);
    expect(assessIssue(snap, { now: NOW }).verdict).toBe("CLEAN");

    // v0.2: the parser finds #1195 in the prose...
    const refs = extractReferences([snap.body, ...snap.comments.map((c) => c.body)], {
      selfNumber: snap.number,
      owner: "toml-rs",
      repo: "toml",
    });
    expect(refs).toContain(1195);

    // ...and once resolved as a CLOSED PR and merged in, the verdict is CONTENTIOUS.
    const enriched = mergeMentionedPullRequests(snap, [
      { number: 1195, isPullRequest: true, state: "CLOSED", isDraft: false },
    ]);
    const result = assessIssue(enriched, { now: NOW });
    expect(result.verdict).toBe("CONTENTIOUS");
    expect(result.evidence.map((e) => e.code)).toContain("mentioned_closed_pr");
  });
});
