// SPDX-License-Identifier: Apache-2.0
import type { BuildInfo } from "./build-system.js";
import { type RepoHealth, repoHealthLine } from "./repo-health.js";
import type { FixabilityResult, Verdict } from "./types.js";

const VERDICT_ICON: Record<Verdict, string> = {
  TAKEN: "🔴",
  CONTENTIOUS: "🟠",
  STALE: "⚪",
  STARTED: "🟡",
  CLEAN: "🟢",
};

/** ANSI dimming, disabled when not a TTY or NO_COLOR is set. */
function dim(s: string, useColor: boolean): string {
  return useColor ? `\x1b[2m${s}\x1b[0m` : s;
}

export interface RenderOptions {
  useColor: boolean;
  build?: BuildInfo | undefined;
  repoHealth?: RepoHealth | undefined;
}

/** Render a single result as a compact, human-readable block. */
export function renderResult(result: FixabilityResult, opts: RenderOptions): string {
  const { issue, verdict, score, evidence } = result;
  const icon = VERDICT_ICON[verdict];
  const lines: string[] = [];
  lines.push(`${icon}  ${verdict}  (score ${score}/100)  #${issue.number} ${issue.title}`);
  lines.push(dim(`    ${issue.url}`, opts.useColor));
  for (const e of evidence) {
    const sign = e.scoreDelta > 0 ? `+${e.scoreDelta}` : `${e.scoreDelta}`;
    lines.push(dim(`    • [${sign}] ${e.message}`, opts.useColor));
  }
  if (evidence.length === 0) {
    lines.push(dim("    • No downgrade or claim signals found.", opts.useColor));
  }
  return lines.join("\n");
}

/** Render a repo-level report (header + build hint + each result, sorted most-fixable first). */
export function renderReport(
  target: string,
  results: FixabilityResult[],
  opts: RenderOptions,
): string {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const clean = sorted.filter((r) => r.verdict === "CLEAN").length;
  const out: string[] = [];
  out.push(`is-it-fixable — ${target}`);
  if (opts.build) {
    out.push(
      dim(`build: ${opts.build.system}${opts.build.hasWrapper ? " (wrapper)" : ""}`, opts.useColor),
    );
  }
  if (opts.repoHealth) {
    out.push(dim(repoHealthLine(opts.repoHealth), opts.useColor));
  }
  out.push(dim(`${results.length} open issue(s) analyzed · ${clean} look CLEAN`, opts.useColor));
  out.push("");
  for (const r of sorted) {
    out.push(renderResult(r, opts));
    out.push("");
  }
  return out.join("\n").trimEnd();
}

/** JSON output shape (stable contract for scripting). */
export interface JsonOutput {
  target: string;
  build?: BuildInfo;
  repoHealth?: RepoHealth;
  results: Array<{
    number: number;
    title: string;
    url: string;
    verdict: Verdict;
    score: number;
    evidence: FixabilityResult["evidence"];
  }>;
}

export function toJsonOutput(
  target: string,
  results: FixabilityResult[],
  build?: BuildInfo,
  repoHealth?: RepoHealth,
): JsonOutput {
  const out: JsonOutput = {
    target,
    results: [...results]
      .sort((a, b) => b.score - a.score)
      .map((r) => ({
        number: r.issue.number,
        title: r.issue.title,
        url: r.issue.url,
        verdict: r.verdict,
        score: r.score,
        evidence: r.evidence,
      })),
  };
  if (build) out.build = build;
  if (repoHealth) out.repoHealth = repoHealth;
  return out;
}
