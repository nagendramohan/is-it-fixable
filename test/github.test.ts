// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type RawIssueNode, mapIssueNode, parseResolvedRefs } from "../src/github.js";
import { parseTarget } from "../src/target.js";

function loadFixture(name: string): RawIssueNode {
  const path = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as RawIssueNode;
}

describe("mapIssueNode", () => {
  it("normalizes labels, comments, PRs, and reopened flag from a raw node", () => {
    const snap = mapIssueNode("acme", "widgets", loadFixture("issue-3119.json"));

    expect(snap.number).toBe(3119);
    expect(snap.owner).toBe("acme");
    expect(snap.labels).toEqual(["bug", "needs-discussion"]);
    expect(snap.reactionsCount).toBe(2);
    expect(snap.reopenedAfterClose).toBe(true);

    // Two closed-unmerged PRs, de-duplicated, correctly typed.
    expect(snap.linkedPullRequests).toHaveLength(2);
    expect(snap.linkedPullRequests.every((p) => p.state === "CLOSED")).toBe(true);
    expect(snap.linkedPullRequests.map((p) => p.number).sort()).toEqual([3122, 3126]);

    // Author associations preserved (maintainer vs community).
    expect(snap.comments[0]?.authorAssociation).toBe("MEMBER");
    expect(snap.comments[1]?.authorAssociation).toBe("NONE");
  });

  it("handles missing/null sub-fields without throwing", () => {
    const bare: RawIssueNode = {
      number: 5,
      title: "bare",
      url: "u",
      state: "OPEN",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    const snap = mapIssueNode("a", "b", bare);
    expect(snap.labels).toEqual([]);
    expect(snap.comments).toEqual([]);
    expect(snap.linkedPullRequests).toEqual([]);
    expect(snap.linkedBranchCount).toBe(0);
    expect(snap.reactionsCount).toBe(0);
    expect(snap.reopenedAfterClose).toBe(false);
  });
});

describe("parseTarget", () => {
  it("parses owner/repo", () => {
    expect(parseTarget("apache/commons-lang")).toEqual({
      kind: "repo",
      owner: "apache",
      repo: "commons-lang",
    });
  });

  it("parses an issue URL", () => {
    expect(parseTarget("https://github.com/toml-rs/toml/issues/1162")).toEqual({
      kind: "issue",
      owner: "toml-rs",
      repo: "toml",
      number: 1162,
    });
  });

  it("parses owner/repo#number", () => {
    expect(parseTarget("smithy-lang/smithy#3119")).toEqual({
      kind: "issue",
      owner: "smithy-lang",
      repo: "smithy",
      number: 3119,
    });
  });

  it("throws on garbage", () => {
    expect(() => parseTarget("not a target")).toThrow(/Could not parse/);
  });
});

describe("parseResolvedRefs", () => {
  it("reads resolved PR aliases and tolerates missing / non-PR entries", () => {
    const repository = {
      r1195: {
        __typename: "PullRequest",
        number: 1195,
        state: "CLOSED",
        merged: false,
        isDraft: false,
      },
      r42: { __typename: "PullRequest", number: 42, state: "OPEN", merged: false, isDraft: true },
      r7: { __typename: "Issue" }, // resolved to an Issue, not a PR -> skipped
      // r999 intentionally absent (non-existent number -> partial data has no alias) -> skipped
    };
    const refs = parseResolvedRefs(repository, [1195, 42, 7, 999]);
    expect(refs).toEqual([
      { number: 1195, isPullRequest: true, state: "CLOSED", isDraft: false },
      { number: 42, isPullRequest: true, state: "OPEN", isDraft: true },
    ]);
  });

  it("returns [] for null/empty repository", () => {
    expect(parseResolvedRefs(null, [1, 2])).toEqual([]);
    expect(parseResolvedRefs({}, [1])).toEqual([]);
  });
});
