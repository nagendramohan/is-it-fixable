// SPDX-License-Identifier: Apache-2.0
import type { IssueSnapshot } from "../src/types.js";

/** Build an IssueSnapshot with sensible defaults; override only what a test cares about. */
export function makeIssue(overrides: Partial<IssueSnapshot> = {}): IssueSnapshot {
  const base: IssueSnapshot = {
    owner: "acme",
    repo: "widgets",
    number: 1,
    title: "Something is wrong",
    url: "https://github.com/acme/widgets/issues/1",
    state: "OPEN",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-10T00:00:00Z",
    body: "",
    labels: [],
    linkedPullRequests: [],
    linkedBranchCount: 0,
    comments: [],
    reactionsCount: 0,
    reopenedAfterClose: false,
  };
  return { ...base, ...overrides };
}

/** A fixed "now" for deterministic staleness tests (2026-08-18). */
export const NOW = Date.parse("2026-08-18T00:00:00Z");
