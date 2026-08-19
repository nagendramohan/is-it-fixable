// SPDX-License-Identifier: Apache-2.0
// Orchestration: fetch -> (enrich with prose mentions) -> assess -> (optionally) detect build system.

import { type BuildInfo, detectBuildSystem } from "./build-system.js";
import {
  type FetchOptions,
  fetchRecentPullRequests,
  fetchRepoIssues,
  fetchRepoTopLevelFiles,
  fetchSingleIssue,
  resolveReferences,
} from "./github.js";
import type { ResolvedRef } from "./github.js";
import { extractReferences } from "./mentions.js";
import { type RepoHealth, assessRepoHealth } from "./repo-health.js";
import { assessIssue } from "./rubric.js";
import type { Target } from "./target.js";
import type { FixabilityResult, IssueSnapshot } from "./types.js";

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
}

export interface AnalyzeResult {
  target: string;
  results: FixabilityResult[];
  build?: BuildInfo | undefined;
  /** Repo-level merge-velocity signal (repo targets only). Never alters per-issue verdicts. */
  repoHealth?: RepoHealth | undefined;
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

  const resolved = await resolveReferences(snap.owner, snap.repo, toResolve, options);
  return mergeMentionedPullRequests(snap, resolved);
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
  if (target.kind === "repo" && options.repoHealth !== false) {
    const recentPrs = await fetchRecentPullRequests(target.owner, target.repo, options);
    repoHealth = assessRepoHealth(recentPrs);
  }

  return { target: label, results, build, repoHealth };
}
