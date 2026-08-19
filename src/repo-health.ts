// SPDX-License-Identifier: Apache-2.0
// Repo merge-velocity / health signal: how readily does a repo merge EXTERNAL (non-member)
// contributions? This is a REPO-level property, kept separate from per-issue verdicts on purpose —
// a slow repo shouldn't silently mask a genuinely CLEAN issue; the user weighs it themselves.

import type { AuthorAssociation } from "./types.js";

/** A recently-closed pull request (merged or closed-unmerged) used for velocity stats. */
export interface RecentPr {
  number: number;
  authorAssociation: AuthorAssociation;
  merged: boolean;
  createdAt: string;
  /** ISO merge timestamp, or null if not merged. */
  mergedAt: string | null;
}

export type RepoHealthVerdict = "HEALTHY" | "SLOW" | "LOW-EXTERNAL-MERGE" | "UNKNOWN";

export interface RepoHealth {
  verdict: RepoHealthVerdict;
  /** Count of external (non-member) PRs in the sample that were merged. */
  externalMergedCount: number;
  /** External PRs (merged + closed-unmerged) in the sample. */
  externalTotalCount: number;
  /** Merged / total among external PRs (0..1), or null when no external PRs. */
  externalMergeRatio: number | null;
  /** Median days-to-merge across merged external PRs, or null when none merged. */
  medianTimeToMergeDays: number | null;
  /** Total PRs examined. */
  sampleSize: number;
  evidence: string[];
}

const MAINTAINER: ReadonlySet<AuthorAssociation> = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const MS_PER_DAY = 86_400_000;
const SLOW_MEDIAN_DAYS = 30;

function isExternal(pr: RecentPr): boolean {
  return !MAINTAINER.has(pr.authorAssociation);
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Assess a repo's external-contribution merge health from a sample of recent closed PRs.
 * Pure function — no I/O.
 */
export function assessRepoHealth(prs: readonly RecentPr[]): RepoHealth {
  const external = prs.filter(isExternal);
  const externalMerged = external.filter((p) => p.merged);
  const ttms: number[] = [];
  for (const p of externalMerged) {
    if (!p.mergedAt) continue;
    const created = Date.parse(p.createdAt);
    const merged = Date.parse(p.mergedAt);
    if (Number.isFinite(created) && Number.isFinite(merged) && merged >= created) {
      ttms.push((merged - created) / MS_PER_DAY);
    }
  }
  const medTtm = median(ttms);
  const medTtmRounded = medTtm === null ? null : Math.round(medTtm * 10) / 10;
  const ratio = external.length === 0 ? null : externalMerged.length / external.length;

  let verdict: RepoHealthVerdict;
  const evidence: string[] = [];

  if (external.length === 0) {
    verdict = "UNKNOWN";
    evidence.push(
      `No external (non-member) PRs found in the last ${prs.length} closed PRs — can't assess external-merge health.`,
    );
  } else if (externalMerged.length === 0) {
    verdict = "LOW-EXTERNAL-MERGE";
    evidence.push(
      `0 of ${external.length} recent external PRs were merged — this repo rarely merges outside contributions.`,
    );
  } else if (medTtmRounded !== null && medTtmRounded > SLOW_MEDIAN_DAYS) {
    verdict = "SLOW";
    evidence.push(
      `Merges external PRs, but slowly: median time-to-merge ${medTtmRounded}d (> ${SLOW_MEDIAN_DAYS}d) over ${externalMerged.length} merged.`,
    );
  } else {
    verdict = "HEALTHY";
    evidence.push(
      `Actively merges external PRs: ${externalMerged.length}/${external.length} recent external PRs merged${medTtmRounded !== null ? `, median time-to-merge ${medTtmRounded}d.` : "."}`,
    );
  }

  return {
    verdict,
    externalMergedCount: externalMerged.length,
    externalTotalCount: external.length,
    externalMergeRatio: ratio,
    medianTimeToMergeDays: medTtmRounded,
    sampleSize: prs.length,
    evidence,
  };
}

/** Short one-line summary for CLI headers. */
export function repoHealthLine(h: RepoHealth): string {
  const ratio =
    h.externalMergeRatio === null ? "n/a" : `${Math.round(h.externalMergeRatio * 100)}%`;
  const ttm = h.medianTimeToMergeDays === null ? "n/a" : `${h.medianTimeToMergeDays}d`;
  return `repo health: ${h.verdict} · external PRs merged ${h.externalMergedCount}/${h.externalTotalCount} (${ratio}) · median merge ${ttm}`;
}
