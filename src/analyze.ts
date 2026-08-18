// SPDX-License-Identifier: Apache-2.0
// Orchestration: fetch → assess → (optionally) detect build system. Network-bound; the CLI calls this.

import { type BuildInfo, detectBuildSystem } from "./build-system.js";
import {
  type FetchOptions,
  fetchRepoIssues,
  fetchRepoTopLevelFiles,
  fetchSingleIssue,
} from "./github.js";
import { assessIssue } from "./rubric.js";
import type { Target } from "./target.js";
import type { FixabilityResult } from "./types.js";

export interface AnalyzeOptions extends FetchOptions {
  /** Also detect the repo build system (one extra API call). */
  detectBuild?: boolean;
}

export interface AnalyzeResult {
  target: string;
  results: FixabilityResult[];
  build?: BuildInfo | undefined;
}

export async function analyze(
  target: Target,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const label = `${target.owner}/${target.repo}${target.kind === "issue" ? `#${target.number}` : ""}`;

  const snapshots =
    target.kind === "issue"
      ? [await fetchSingleIssue(target.owner, target.repo, target.number, options)]
      : await fetchRepoIssues(target.owner, target.repo, options);

  const results = snapshots.map((s) => assessIssue(s));

  let build: BuildInfo | undefined;
  if (options.detectBuild) {
    const files = await fetchRepoTopLevelFiles(target.owner, target.repo, options);
    build = detectBuildSystem(files);
  }

  return { target: label, results, build };
}
