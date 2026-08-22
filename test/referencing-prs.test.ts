// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { mergeReferencedPullRequests } from "../src/analyze.js";
import { type RawSearchPrItem, mapSearchPrItem } from "../src/github.js";
import { assessIssue } from "../src/rubric.js";
import { NOW, makeIssue } from "./helpers.js";

describe("mapSearchPrItem", () => {
  it("maps an open PR search item to a 'referenced' LinkedPullRequest", () => {
    const item: RawSearchPrItem = { number: 13938, state: "open", draft: false, pull_request: {} };
    expect(mapSearchPrItem(item)).toEqual({
      number: 13938,
      state: "OPEN",
      isDraft: false,
      linkType: "referenced",
    });
  });

  it("maps closed and merged states", () => {
    expect(mapSearchPrItem({ number: 1, state: "closed", pull_request: {} })?.state).toBe("CLOSED");
    expect(
      mapSearchPrItem({ number: 2, state: "closed", pull_request: { merged_at: "2026-01-01" } })
        ?.state,
    ).toBe("MERGED");
  });

  it("returns null for a non-PR (plain issue) item", () => {
    expect(mapSearchPrItem({ number: 5, state: "open" })).toBeNull();
  });
});

describe("mergeReferencedPullRequests", () => {
  it("adds referencing PRs, skipping numbers already present from the timeline", () => {
    const snap = makeIssue({
      linkedPullRequests: [
        { number: 10, state: "OPEN", isDraft: false, linkType: "cross-referenced" },
      ],
    });
    const merged = mergeReferencedPullRequests(snap, [
      { number: 10, state: "OPEN", isDraft: false, linkType: "referenced" }, // dup -> skipped
      { number: 20, state: "OPEN", isDraft: false, linkType: "referenced" },
    ]);
    expect(merged.linkedPullRequests.map((p) => p.number).sort()).toEqual([10, 20]);
  });
});

describe("rubric: a search-found 'referenced' open PR marks the issue TAKEN", () => {
  it("TAKEN when only a referenced (not timeline-linked) open PR exists", () => {
    const r = assessIssue(
      makeIssue({
        linkedPullRequests: [
          { number: 13938, state: "OPEN", isDraft: false, linkType: "referenced" },
        ],
      }),
      { now: NOW },
    );
    expect(r.verdict).toBe("TAKEN");
  });

  it("CONTENTIOUS when a referenced PR is closed-unmerged", () => {
    const r = assessIssue(
      makeIssue({
        linkedPullRequests: [
          { number: 99, state: "CLOSED", isDraft: false, linkType: "referenced" },
        ],
      }),
      { now: NOW },
    );
    expect(r.verdict).toBe("CONTENTIOUS");
  });
});
