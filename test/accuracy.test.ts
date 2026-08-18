// SPDX-License-Identifier: Apache-2.0
// Accuracy gate — the credibility centerpiece.
// Each fixture is a real issue we hand-graded during manual triage. We assert the FULL pipeline
// (mapIssueNode -> assessIssue) reproduces our human verdict. If the engine ever regresses on a
// known case, this fails.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type RawIssueNode, mapIssueNode } from "../src/github.js";
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
});
