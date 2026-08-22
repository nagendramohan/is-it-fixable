// SPDX-License-Identifier: Apache-2.0
// v0.4 accuracy gate — the headline regression.
//
// These six issues each ALREADY had an open fix PR, but the issue *timeline* surfaced no
// cross-reference, so timeline-only claim detection (v0.3 and earlier) reported them CLEAN. That
// blind spot caused six real duplicate PRs. v0.4 detects the referencing PR via search and must
// now report each as TAKEN.
//
// Each case models the real situation: an empty timeline (no linked PRs from events) PLUS a
// search-found "referenced" open PR (what searchReferencingPullRequests returns live).

import { describe, expect, it } from "vitest";
import { mergeReferencedPullRequests } from "../src/analyze.js";
import { assessIssue } from "../src/rubric.js";
import type { IssueSnapshot, LinkedPullRequest } from "../src/types.js";

const NOW = Date.parse("2026-08-22T00:00:00Z");

function issueWithNoTimelineLinks(owner: string, repo: string, number: number): IssueSnapshot {
  return {
    owner,
    repo,
    number,
    title: "crash bug",
    url: `https://github.com/${owner}/${repo}/issues/${number}`,
    state: "OPEN",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
    body: "",
    labels: ["bug"],
    linkedPullRequests: [], // timeline surfaced nothing — the v0.3 blind spot
    linkedBranchCount: 0,
    comments: [],
    reactionsCount: 0,
    reopenedAfterClose: false,
  };
}

// The real duplicates: (issue) -> the pre-existing open PR a search finds.
const KNOWN_DUPLICATES: Array<{ owner: string; repo: string; issue: number; existingPr: number }> =
  [
    { owner: "sharkdp", repo: "bat", issue: 3844, existingPr: 3847 },
    { owner: "sharkdp", repo: "fd", issue: 2078, existingPr: 2090 },
    { owner: "sharkdp", repo: "numbat", issue: 873, existingPr: 874 },
    { owner: "uutils", repo: "coreutils", issue: 13887, existingPr: 13901 },
    { owner: "uutils", repo: "coreutils", issue: 13937, existingPr: 13938 },
    { owner: "uutils", repo: "coreutils", issue: 13347, existingPr: 13880 },
  ];

describe("accuracy gate v0.4 — referencing-PR search closes the claim-detection blind spot", () => {
  for (const c of KNOWN_DUPLICATES) {
    it(`${c.owner}/${c.repo}#${c.issue}: timeline-empty but referenced by open PR #${c.existingPr} -> TAKEN`, () => {
      const snap = issueWithNoTimelineLinks(c.owner, c.repo, c.issue);

      // v0.3 behavior (timeline only): no links -> wrongly CLEAN. This is the bug that caused the dup.
      expect(assessIssue(snap, { now: NOW }).verdict).toBe("CLEAN");

      // v0.4: the PR search finds the existing open PR; fold it in and the issue is correctly TAKEN.
      const referencing: LinkedPullRequest[] = [
        { number: c.existingPr, state: "OPEN", isDraft: false, linkType: "referenced" },
      ];
      const enriched = mergeReferencedPullRequests(snap, referencing);
      expect(assessIssue(enriched, { now: NOW }).verdict).toBe("TAKEN");
    });
  }
});
