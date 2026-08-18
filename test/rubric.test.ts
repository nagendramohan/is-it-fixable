// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { assessIssue } from "../src/rubric.js";
import { NOW, makeIssue } from "./helpers.js";

describe("assessIssue — core verdicts", () => {
  it("returns CLEAN for a fresh, unclaimed, unlabeled issue", () => {
    const r = assessIssue(makeIssue(), { now: NOW });
    expect(r.verdict).toBe("CLEAN");
    expect(r.score).toBeGreaterThanOrEqual(50);
  });

  it("returns TAKEN when an open non-draft PR is linked", () => {
    const r = assessIssue(
      makeIssue({
        linkedPullRequests: [
          { number: 42, state: "OPEN", isDraft: false, linkType: "cross-referenced" },
        ],
      }),
      { now: NOW },
    );
    expect(r.verdict).toBe("TAKEN");
    expect(r.evidence.some((e) => e.code === "open_pr")).toBe(true);
    expect(r.score).toBeLessThan(50);
  });

  it("returns STARTED for a draft PR (not TAKEN)", () => {
    const r = assessIssue(
      makeIssue({
        linkedPullRequests: [{ number: 7, state: "OPEN", isDraft: true, linkType: "connected" }],
      }),
      { now: NOW },
    );
    expect(r.verdict).toBe("STARTED");
  });

  it("returns CONTENTIOUS when a closed-unmerged PR exists", () => {
    const r = assessIssue(
      makeIssue({
        linkedPullRequests: [
          { number: 99, state: "CLOSED", isDraft: false, linkType: "cross-referenced" },
        ],
      }),
      { now: NOW },
    );
    expect(r.verdict).toBe("CONTENTIOUS");
    expect(r.evidence.some((e) => e.code === "closed_unmerged_pr")).toBe(true);
  });

  it("treats a maintainer won't-fix comment as CONTENTIOUS, but ignores non-maintainers", () => {
    const maintainer = assessIssue(
      makeIssue({
        comments: [
          {
            authorAssociation: "MEMBER",
            body: "Thanks, but this is by design.",
            createdAt: NOW.toString(),
          },
        ],
      }),
      { now: NOW },
    );
    expect(maintainer.verdict).toBe("CONTENTIOUS");

    const randomUser = assessIssue(
      makeIssue({
        comments: [
          {
            authorAssociation: "NONE",
            body: "I think this is by design.",
            createdAt: NOW.toString(),
          },
        ],
      }),
      { now: NOW },
    );
    expect(randomUser.verdict).not.toBe("CONTENTIOUS");
  });

  it("flags STALE for long-idle issues with no stronger signal", () => {
    const r = assessIssue(makeIssue({ updatedAt: "2024-01-01T00:00:00Z" }), { now: NOW });
    expect(r.verdict).toBe("STALE");
    expect(r.evidence.some((e) => e.code === "stale")).toBe(true);
  });
});
