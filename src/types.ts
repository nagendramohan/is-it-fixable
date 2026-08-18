// SPDX-License-Identifier: Apache-2.0
// Core domain types for is-it-fixable.

/** The headline classification for an issue. First matching verdict (by priority) wins. */
export type Verdict = "TAKEN" | "CONTENTIOUS" | "STALE" | "STARTED" | "CLEAN";

/** How much we trust a comment's author to speak for the project. */
export type AuthorAssociation =
  | "OWNER"
  | "MEMBER"
  | "COLLABORATOR"
  | "CONTRIBUTOR"
  | "FIRST_TIME_CONTRIBUTOR"
  | "FIRST_TIMER"
  | "NONE";

export type PullRequestState = "OPEN" | "CLOSED" | "MERGED";

/** A pull request linked to the issue via a timeline cross-reference/connection. */
export interface LinkedPullRequest {
  number: number;
  state: PullRequestState;
  isDraft: boolean;
  /** How the PR became linked: a mention (cross-referenced) or a linked branch (connected). */
  linkType: "cross-referenced" | "connected";
}

export interface IssueComment {
  authorAssociation: AuthorAssociation;
  body: string;
  createdAt: string;
}

/** Normalized snapshot of one GitHub issue, decoupled from the raw API shape. */
export interface IssueSnapshot {
  owner: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  labels: string[];
  linkedPullRequests: LinkedPullRequest[];
  linkedBranchCount: number;
  comments: IssueComment[];
  reactionsCount: number;
  /** Whether the issue was reopened after having been closed (maintainer-staging signal). */
  reopenedAfterClose: boolean;
}

/** A single scored signal, with the evidence that produced it (explainability). */
export interface Evidence {
  /** Machine-readable signal id, e.g. "open_pr", "closed_unmerged_pr", "wontfix_label". */
  code: string;
  /** Human-readable explanation shown to the user. */
  message: string;
  /** Score delta this signal applied (positive = more fixable). */
  scoreDelta: number;
}

/** The full result for one issue. */
export interface FixabilityResult {
  issue: IssueSnapshot;
  verdict: Verdict;
  /** 0–100; higher = more likely fixable and worth picking. */
  score: number;
  evidence: Evidence[];
}
