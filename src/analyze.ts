// SPDX-License-Identifier: Apache-2.0
// Orchestration: fetch -> (enrich with prose mentions) -> assess -> (optionally) detect build system.

import { type BuildInfo, detectBuildSystem } from "./build-system.js";
import {
  type FetchOptions,
  type SignatureMatch,
  fetchRecentPullRequests,
  fetchRepoIssues,
  fetchRepoTopLevelFiles,
  fetchSingleIssue,
  resolveReferences,
  searchIssuesByText,
  searchReferencingPullRequests,
} from "./github.js";
import type { ResolvedRef } from "./github.js";
import { extractReferences } from "./mentions.js";
import { type RepoHealth, assessRepoHealth } from "./repo-health.js";
import { assessIssue } from "./rubric.js";
import { extractErrorSignatures, signatureSearchQuery } from "./signatures.js";
import type { Target } from "./target.js";
import type { FixabilityResult, IssueSnapshot, LinkedPullRequest } from "./types.js";

export interface AnalyzeOptions extends FetchOptions {
  /** Also detect the repo build system (one extra API call). */
  detectBuild?: boolean;
  /**
   * Scan issue body + comments for prose PR references (e.g. "#1195") and resolve their state,
   * catching PRs that produced no structured timeline event. One extra API call per issue that
   * has unresolved references. Default true.
   */
  resolveMentions?: boolean;
  /**
   * For repo targets, assess how readily the repo merges external PRs (one extra API call).
   * Ignored for single-issue targets. Default true.
   */
  repoHealth?: boolean;
  /**
   * Search for pull requests that REFERENCE each issue (one search-API call per issue). This
   * catches fix PRs that the issue timeline does not surface — the primary claim signal.
   * Default true.
   */
  resolveReferencingPrs?: boolean;
  /**
   * For single-issue targets, search for other issues/PRs carrying the same error signature to
   * flag a likely-known/duplicate problem (one extra search call). Default true.
   */
  resolveSignatures?: boolean;
}

export interface AnalyzeResult {
  target: string;
  results: FixabilityResult[];
  build?: BuildInfo | undefined;
  /** Repo-level merge-velocity signal (repo targets only). Never alters per-issue verdicts. */
  repoHealth?: RepoHealth | undefined;
  /**
   * Other issues/PRs carrying the same error signature (single-issue targets only). A non-empty
   * list means the bug may already be known/tracked/attempted under a different number — a strong
   * "look before you leap" signal that issue-number claim detection alone would miss.
   */
  relatedByErrorSignature?: SignatureMatch[] | undefined;
}

/**
 * Pure: fold resolved reference PRs into a snapshot as linkType "mentioned",
 * skipping numbers already present. Exported for deterministic (offline) testing.
 */
export function mergeMentionedPullRequests(
  snap: IssueSnapshot,
  resolved: readonly ResolvedRef[],
): IssueSnapshot {
  const already = new Set(snap.linkedPullRequests.map((p) => p.number));
  const mentioned = resolved
    .filter((r) => r.isPullRequest && !already.has(r.number))
    .map((r) => ({
      number: r.number,
      state: r.state,
      isDraft: r.isDraft,
      linkType: "mentioned" as const,
    }));
  if (mentioned.length === 0) return snap;
  return { ...snap, linkedPullRequests: [...snap.linkedPullRequests, ...mentioned] };
}

/**
 * Enrich a snapshot with prose-mentioned PRs that produced no structured timeline event.
 */
async function enrichWithMentions(
  snap: IssueSnapshot,
  options: AnalyzeOptions,
): Promise<IssueSnapshot> {
  const texts = [snap.body, ...snap.comments.map((c) => c.body)];
  const candidates = extractReferences(texts, {
    selfNumber: snap.number,
    owner: snap.owner,
    repo: snap.repo,
  });
  const already = new Set(snap.linkedPullRequests.map((p) => p.number));
  const toResolve = candidates.filter((n) => !already.has(n));
  if (toResolve.length === 0) return snap;

  // Never let a single issue's reference resolution abort the whole scan — degrade to the
  // un-enriched snapshot on any failure.
  let resolved: ResolvedRef[];
  try {
    resolved = await resolveReferences(snap.owner, snap.repo, toResolve, options);
  } catch {
    return snap;
  }
  return mergeMentionedPullRequests(snap, resolved);
}

/**
 * Pure: fold search-found referencing PRs into a snapshot, skipping numbers already present (from
 * the timeline or prose mentions). Exported for deterministic (offline) testing.
 */
export function mergeReferencedPullRequests(
  snap: IssueSnapshot,
  referencing: readonly LinkedPullRequest[],
): IssueSnapshot {
  const already = new Set(snap.linkedPullRequests.map((p) => p.number));
  const extra = referencing.filter((p) => !already.has(p.number));
  if (extra.length === 0) return snap;
  return { ...snap, linkedPullRequests: [...snap.linkedPullRequests, ...extra] };
}

/**
 * Enrich a snapshot with PRs that reference the issue (found via search). One search-API call.
 * Degrades to the un-enriched snapshot on any failure so it never aborts a scan.
 */
async function enrichWithReferencingPrs(
  snap: IssueSnapshot,
  options: AnalyzeOptions,
): Promise<IssueSnapshot> {
  try {
    const referencing = await searchReferencingPullRequests(
      snap.owner,
      snap.repo,
      snap.number,
      options,
    );
    return mergeReferencedPullRequests(snap, referencing);
  } catch {
    return snap;
  }
}

export async function analyze(
  target: Target,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const label = `${target.owner}/${target.repo}${target.kind === "issue" ? `#${target.number}` : ""}`;

  let snapshots =
    target.kind === "issue"
      ? [await fetchSingleIssue(target.owner, target.repo, target.number, options)]
      : await fetchRepoIssues(target.owner, target.repo, options);

  // PR-search claim detection first (the primary, most reliable claim signal): it catches fix PRs
  // that the issue timeline never surfaces.
  if (options.resolveReferencingPrs !== false) {
    snapshots = await Promise.all(snapshots.map((s) => enrichWithReferencingPrs(s, options)));
  }

  if (options.resolveMentions !== false) {
    snapshots = await Promise.all(snapshots.map((s) => enrichWithMentions(s, options)));
  }

  const results = snapshots.map((s) => assessIssue(s));

  let build: BuildInfo | undefined;
  if (options.detectBuild) {
    const files = await fetchRepoTopLevelFiles(target.owner, target.repo, options);
    build = detectBuildSystem(files);
  }

  let repoHealth: RepoHealth | undefined;
  if (options.repoHealth !== false) {
    // Assess for both repo scans and single-issue checks: when deciding whether to work on ONE
    // issue, knowing the repo is CLOSED-TO-EXTERNAL (e.g. Textualize/rich) is exactly the signal
    // that prevents wasted effort.
    const recentPrs = await fetchRecentPullRequests(target.owner, target.repo, options);
    repoHealth = assessRepoHealth(recentPrs);
  }

  // Error-signature cross-search (single-issue targets only — one extra search call, where the
  // precision matters most). Detects a bug already known/attempted under a different issue number.
  let relatedByErrorSignature: SignatureMatch[] | undefined;
  if (target.kind === "issue" && options.resolveSignatures !== false && snapshots[0]) {
    const snap = snapshots[0];
    const sigs = extractErrorSignatures(snap.title, snap.body ?? "");
    if (sigs[0]) {
      const query = signatureSearchQuery(target.owner, target.repo, sigs[0]);
      relatedByErrorSignature = await searchIssuesByText(query, snap.number, options);
    }
  }

  return { target: label, results, build, repoHealth, relatedByErrorSignature };
}
