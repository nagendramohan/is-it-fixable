// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { type RecentPr, assessRepoHealth, repoHealthLine } from "../src/repo-health.js";

function pr(over: Partial<RecentPr> & Pick<RecentPr, "number">): RecentPr {
  return {
    authorAssociation: "CONTRIBUTOR",
    merged: false,
    createdAt: "2026-08-01T00:00:00Z",
    mergedAt: null,
    ...over,
  };
}

describe("assessRepoHealth — CLOSED-TO-EXTERNAL gate (the rich lesson)", () => {
  it("flags a repo whose recent human PRs are all members/collaborators (0 external)", () => {
    // Model Textualize/rich: a healthy sample, but every human PR is COLLABORATOR/MEMBER + bots.
    const prs: RecentPr[] = [];
    for (let i = 1; i <= 12; i++) {
      prs.push(pr({ number: i, authorAssociation: "COLLABORATOR", authorLogin: "KRRT7" }));
    }
    prs.push(pr({ number: 13, authorAssociation: "MEMBER", authorLogin: "willmcgugan" }));
    // dependabot carries CONTRIBUTOR association but must NOT count as an external human PR.
    for (let i = 14; i <= 18; i++) {
      prs.push(pr({ number: i, authorAssociation: "CONTRIBUTOR", authorLogin: "dependabot[bot]" }));
    }
    const h = assessRepoHealth(prs);
    expect(h.verdict).toBe("CLOSED-TO-EXTERNAL");
    expect(h.externalTotalCount).toBe(0);
    expect(h.evidence[0]).toMatch(/closed to outside PRs/i);
  });

  it("stays UNKNOWN (not CLOSED) when the sample is too small to conclude", () => {
    const prs: RecentPr[] = [
      pr({ number: 1, authorAssociation: "MEMBER", authorLogin: "maintainer" }),
      pr({ number: 2, authorAssociation: "COLLABORATOR", authorLogin: "collab" }),
    ];
    expect(assessRepoHealth(prs).verdict).toBe("UNKNOWN");
  });

  it("a single genuine external human PR is enough to avoid the CLOSED verdict", () => {
    const prs: RecentPr[] = [];
    for (let i = 1; i <= 16; i++) {
      prs.push(pr({ number: i, authorAssociation: "COLLABORATOR", authorLogin: "collab" }));
    }
    prs.push(
      pr({
        number: 99,
        authorAssociation: "NONE",
        authorLogin: "outsider",
        merged: true,
        createdAt: "2026-08-01T00:00:00Z",
        mergedAt: "2026-08-02T00:00:00Z",
      }),
    );
    expect(assessRepoHealth(prs).verdict).not.toBe("CLOSED-TO-EXTERNAL");
  });
});

describe("assessRepoHealth", () => {
  it("HEALTHY: external PRs merged quickly", () => {
    const h = assessRepoHealth([
      pr({
        number: 1,
        merged: true,
        createdAt: "2026-08-01T00:00:00Z",
        mergedAt: "2026-08-03T00:00:00Z",
      }),
      pr({
        number: 2,
        merged: true,
        createdAt: "2026-08-01T00:00:00Z",
        mergedAt: "2026-08-02T00:00:00Z",
      }),
      pr({
        number: 3,
        authorAssociation: "MEMBER",
        merged: true,
        mergedAt: "2026-08-01T00:00:00Z",
      }),
    ]);
    expect(h.verdict).toBe("HEALTHY");
    expect(h.externalMergedCount).toBe(2);
    expect(h.externalTotalCount).toBe(2); // member PR excluded from "external"
    expect(h.medianTimeToMergeDays).toBe(1.5);
  });

  it("SLOW: external PRs merge but median time-to-merge exceeds threshold", () => {
    const h = assessRepoHealth([
      pr({
        number: 1,
        merged: true,
        createdAt: "2026-06-01T00:00:00Z",
        mergedAt: "2026-08-01T00:00:00Z",
      }), // ~61d
      pr({
        number: 2,
        merged: true,
        createdAt: "2026-06-01T00:00:00Z",
        mergedAt: "2026-07-15T00:00:00Z",
      }), // ~44d
    ]);
    expect(h.verdict).toBe("SLOW");
    expect(h.medianTimeToMergeDays as number).toBeGreaterThan(30);
  });

  it("LOW-EXTERNAL-MERGE: external PRs exist but none merged", () => {
    const h = assessRepoHealth([
      pr({ number: 1, merged: false }),
      pr({ number: 2, merged: false }),
      pr({ number: 3, authorAssociation: "OWNER", merged: true, mergedAt: "2026-08-02T00:00:00Z" }),
    ]);
    expect(h.verdict).toBe("LOW-EXTERNAL-MERGE");
    expect(h.externalMergedCount).toBe(0);
    expect(h.externalMergeRatio).toBe(0);
  });

  it("UNKNOWN: no external PRs in the sample", () => {
    const h = assessRepoHealth([
      pr({
        number: 1,
        authorAssociation: "MEMBER",
        merged: true,
        mergedAt: "2026-08-02T00:00:00Z",
      }),
      pr({ number: 2, authorAssociation: "OWNER", merged: false }),
    ]);
    expect(h.verdict).toBe("UNKNOWN");
    expect(h.externalMergeRatio).toBeNull();
    expect(h.medianTimeToMergeDays).toBeNull();
  });

  it("empty sample -> UNKNOWN", () => {
    expect(assessRepoHealth([]).verdict).toBe("UNKNOWN");
  });

  it("repoHealthLine renders a compact summary", () => {
    const line = repoHealthLine(assessRepoHealth([pr({ number: 1, merged: false })]));
    expect(line).toContain("repo health:");
    expect(line).toContain("LOW-EXTERNAL-MERGE");
  });
});
