// SPDX-License-Identifier: Apache-2.0
// The fixability rubric: turn an IssueSnapshot into a verdict + score + evidence.
// Deterministic and explainable by design (no LLM) — every signal cites its source.

import type {
  AuthorAssociation,
  Evidence,
  FixabilityResult,
  IssueSnapshot,
  Verdict,
} from "./types.js";

/** Author associations we treat as "maintainer voice". */
const MAINTAINER_ASSOCIATIONS: ReadonlySet<AuthorAssociation> = new Set([
  "OWNER",
  "MEMBER",
  "COLLABORATOR",
]);

/** Labels that reduce fixability (issue may be parked, disputed, or non-actionable). */
export const DOWNGRADE_LABELS: ReadonlyArray<string> = [
  "wontfix",
  "won't fix",
  "by-design",
  "by design",
  "needs-discussion",
  "needs discussion",
  "question",
  "invalid",
  "blocked",
  "duplicate",
  "stale",
];

/** Labels that signal the maintainers WANT external help. */
export const POSITIVE_LABELS: ReadonlyArray<string> = [
  "good first issue",
  "good-first-issue",
  "help wanted",
  "help-wanted",
  "e-help-wanted",
  "bug",
];

/** Conservative, false-negative-biased phrases indicating a maintainer won't take a fix. */
export const NEGATIVE_PHRASES: ReadonlyArray<string> = [
  "won't fix",
  "wont fix",
  "by design",
  "working as intended",
  "not a bug",
  "not planning",
  "out of scope",
  "closing as",
  "won't be fixing",
  "we won't",
];

const STALE_DAYS = 365;
const MS_PER_DAY = 86_400_000;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function daysBetween(iso: string, now: number): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / MS_PER_DAY));
}

export interface AssessOptions {
  /** Injectable clock for deterministic tests. Defaults to Date.now(). */
  now?: number;
}

/**
 * Assess a single issue's fixability. Pure function — no I/O.
 */
export function assessIssue(issue: IssueSnapshot, opts: AssessOptions = {}): FixabilityResult {
  const now = opts.now ?? Date.now();
  const evidence: Evidence[] = [];
  let score = 50;

  const add = (code: string, message: string, delta: number): void => {
    evidence.push({ code, message, scoreDelta: delta });
    score += delta;
  };

  // --- Tier 1: claim signals ---
  const openPr = issue.linkedPullRequests.find((p) => p.state === "OPEN" && !p.isDraft);
  const draftPr = issue.linkedPullRequests.find((p) => p.state === "OPEN" && p.isDraft);
  const closedUnmergedPrs = issue.linkedPullRequests.filter((p) => p.state === "CLOSED");
  const mergedPrs = issue.linkedPullRequests.filter((p) => p.state === "MERGED");

  if (openPr) {
    add("open_pr", `Open PR #${openPr.number} is already linked (someone is fixing this).`, -45);
  }
  if (draftPr) {
    add("draft_pr", `Draft PR #${draftPr.number} is linked (someone has started).`, -20);
  }
  if (!openPr && !draftPr && issue.linkedBranchCount > 0) {
    add("linked_branch", `${issue.linkedBranchCount} linked branch(es) exist but no PR yet.`, -10);
  }

  // --- Tier 2: fixability signals ---
  if (closedUnmergedPrs.length > 0) {
    const nums = closedUnmergedPrs.map((p) => `#${p.number}`).join(", ");
    add(
      "closed_unmerged_pr",
      `Closed, unmerged PR(s) ${nums} — a prior fix attempt was rejected or abandoned.`,
      -25,
    );
  }
  if (mergedPrs.length > 0) {
    const nums = mergedPrs.map((p) => `#${p.number}`).join(", ");
    add(
      "merged_pr_issue_open",
      `Merged PR(s) ${nums} reference this issue but it is still open — it may already be fixed; verify on the default branch.`,
      -15,
    );
  }

  const lowerLabels = issue.labels.map((l) => l.toLowerCase());
  const matchedDowngrade = DOWNGRADE_LABELS.filter((l) => lowerLabels.includes(l));
  // De-duplicate near-synonyms (e.g. "wontfix" vs "won't fix") by capping total penalty.
  if (matchedDowngrade.length > 0) {
    add(
      "downgrade_label",
      `Downgrade label(s): ${matchedDowngrade.join(", ")}.`,
      clamp(-20 * matchedDowngrade.length, -40, 0),
    );
  }
  const matchedPositive = POSITIVE_LABELS.filter((l) => lowerLabels.includes(l));
  if (matchedPositive.length > 0) {
    const strong = matchedPositive.some((l) => l.includes("help") || l.includes("good first"));
    add(
      "positive_label",
      `Contribution-friendly label(s): ${matchedPositive.join(", ")}.`,
      strong ? 15 : 8,
    );
  }

  if (issue.reopenedAfterClose) {
    add(
      "reopened_after_close",
      "Issue was reopened after being closed — often a maintainer-staged rollout, not open work.",
      -15,
    );
  }

  // Maintainer sentiment: only trust maintainer-authored comments.
  const maintainerComments = issue.comments.filter((c) =>
    MAINTAINER_ASSOCIATIONS.has(c.authorAssociation),
  );
  const negativeComment = maintainerComments.find((c) => {
    const body = c.body.toLowerCase();
    return NEGATIVE_PHRASES.some((p) => body.includes(p));
  });
  if (negativeComment) {
    add(
      "maintainer_negative",
      "A maintainer comment signals this may not be fixed (e.g. won't-fix / by-design / out-of-scope).",
      -25,
    );
  } else if (maintainerComments.length === 0 && issue.comments.length > 0) {
    add("no_maintainer_engagement", "No maintainer has engaged in the discussion yet.", -10);
  }

  // Staleness.
  const idleDays = daysBetween(issue.updatedAt, now);
  if (idleDays > STALE_DAYS) {
    add(
      "stale",
      `No activity for ${idleDays} days (> ${STALE_DAYS}).`,
      clamp(-Math.floor(idleDays / STALE_DAYS) * 8, -15, 0),
    );
  }

  score = clamp(Math.round(score), 0, 100);

  const verdict = decideVerdict({
    hasOpenPr: Boolean(openPr),
    hasDraftOrBranch: Boolean(draftPr) || issue.linkedBranchCount > 0,
    contentious:
      closedUnmergedPrs.length > 0 ||
      matchedDowngrade.length > 0 ||
      issue.reopenedAfterClose ||
      Boolean(negativeComment),
    stale: idleDays > STALE_DAYS,
  });

  return { issue, verdict, score, evidence };
}

function decideVerdict(s: {
  hasOpenPr: boolean;
  hasDraftOrBranch: boolean;
  contentious: boolean;
  stale: boolean;
}): Verdict {
  if (s.hasOpenPr) return "TAKEN";
  if (s.contentious) return "CONTENTIOUS";
  if (s.hasDraftOrBranch) return "STARTED";
  if (s.stale) return "STALE";
  return "CLEAN";
}
